import jwt from "jsonwebtoken";
import { ApiError } from "../utils/apiError";
import { UserModel, type UserStatus } from "../models/User";
import { StaffProfileModel } from "../models/StaffProfile";
import { hashPassword, verifyPassword } from "../utils/crypto";
import type { Role } from "../types/express";
import { nextHumanId, sequenceKeyForRole } from "./idService";
import { recordStatusChange } from "./statusLogService";
import { saveBase64Image, type Base64ImageInput } from "../utils/base64Image";

export type RegisterCandidateInput = {
  email: string;
  fullName: string;
  phone?: string;
  password: string;
  role: Extract<Role, "STAFF" | "TRAINEE">;

  aadharNumberLast4?: string;
  additionalDetails?: {
    address?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  };
  professional?: {
    qualification?: string;
    experienceSummary?: string;
  };
  livePhoto?: Base64ImageInput;
  certificates?: { name: string; image: Base64ImageInput }[];
};

export async function registerCandidate(input: RegisterCandidateInput) {
  const existing = await UserModel.findOne({ email: input.email });
  if (existing) throw new ApiError(409, "Email already registered");

  // Save the user's chosen password — admin only approves later, no temp password.
  const passwordHash = await hashPassword(input.password);
  const user = await UserModel.create({
    email: input.email,
    fullName: input.fullName,
    phone: input.phone,
    role: input.role,
    status: "PENDING_APPROVAL" satisfies UserStatus,
    passwordHash,
    mustChangePassword: false,
  });

  // Build staff profile from submitted form data.
  const livePhotoSaved = input.livePhoto ? saveBase64Image(input.livePhoto) : null;
  const certificatesSaved = (input.certificates ?? []).map((c) => {
    const img = saveBase64Image(c.image);
    return {
      name: c.name,
      filePath: img.filePath,
      uploadedAt: img.uploadedAt,
    };
  });

  await StaffProfileModel.create({
    userId: user._id,
    livePhotoPath: livePhotoSaved?.filePath,
    aadharNumberLast4: input.aadharNumberLast4,
    additionalDetails: input.additionalDetails,
    professional: {
      qualification: input.professional?.qualification,
      experienceSummary: input.professional?.experienceSummary,
      certificates: certificatesSaved,
    },
  });

  await recordStatusChange({
    entityType: "USER",
    entityId: user._id.toString(),
    toStatus: "PENDING_APPROVAL",
    changedByUserId: user._id.toString(),
    note: "Self-registered",
    metadata: { role: user.role },
  });

  return {
    id: user._id.toString(),
    status: user.status,
    role: user.role,
    message: "Registration submitted. Waiting for admin approval.",
  };
}

export async function bootstrapSuperAdmin(input: {
  email: string;
  fullName: string;
  password: string;
  bootstrapKey?: string;
}) {
  const requiredKey = process.env.BOOTSTRAP_SUPER_ADMIN_KEY;
  if (!requiredKey) throw new ApiError(400, "BOOTSTRAP_SUPER_ADMIN_KEY not configured");
  if (!input.bootstrapKey || input.bootstrapKey !== requiredKey) {
    throw new ApiError(403, "Invalid bootstrap key");
  }

  const count = await UserModel.countDocuments({});
  if (count > 0) throw new ApiError(409, "Bootstrap is only allowed on an empty database");

  const passwordHash = await hashPassword(input.password);
  const user = await UserModel.create({
    email: input.email,
    fullName: input.fullName,
    role: "SUPER_ADMIN" satisfies Role,
    status: "ACTIVE" satisfies UserStatus,
    passwordHash,
    mustChangePassword: false,
  });

  return { id: user._id.toString() };
}

export async function login(input: { email: string; password: string }) {
  const user = await UserModel.findOne({ email: input.email });
  if (!user) throw new ApiError(401, "Invalid email or password");
  if (user.status !== "ACTIVE") throw new ApiError(403, `Account is not active (${user.status})`);

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw new ApiError(401, "Invalid email or password");

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new ApiError(500, "JWT_SECRET not configured");

  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, secret, {
    expiresIn: "7d",
  });

  return { token, mustChangePassword: user.mustChangePassword, role: user.role };
}

export async function changePassword(input: {
  userId: string;
  oldPassword?: string;
  newPassword: string;
}) {
  const user = await UserModel.findById(input.userId);
  if (!user) throw new ApiError(404, "User not found");
  if (user.status !== "ACTIVE") throw new ApiError(403, "Account is not active");

  if (!user.mustChangePassword) {
    if (!input.oldPassword) throw new ApiError(400, "oldPassword is required");
    const ok = await verifyPassword(input.oldPassword, user.passwordHash);
    if (!ok) throw new ApiError(401, "Invalid old password");
  }

  user.passwordHash = await hashPassword(input.newPassword);
  user.mustChangePassword = false;
  await user.save();
}

export async function approveCandidate(input: { candidateId: string; approvedByUserId: string }) {
  const user = await UserModel.findById(input.candidateId);
  if (!user) throw new ApiError(404, "Candidate not found");
  if (user.status !== "PENDING_APPROVAL")
    throw new ApiError(409, "Candidate is not pending approval");

  const fromStatus = user.status as UserStatus;

  const seqKey = sequenceKeyForRole(user.role as Role);
  if (seqKey) {
    const generated = await nextHumanId(seqKey);
    user.humanId = generated;
    if (user.role === "TRAINEE") {
      user.traineeId = generated;
    } else if (user.role === "STAFF") {
      user.employeeId = generated;
    }
  }

  // Keep the password the user set during registration. Just activate the account.
  user.status = "ACTIVE";
  user.rejectedReason = undefined;

  await user.save();

  await recordStatusChange({
    entityType: "USER",
    entityId: user._id.toString(),
    fromStatus,
    toStatus: "ACTIVE",
    changedByUserId: input.approvedByUserId,
    metadata: {
      role: user.role,
      humanId: user.humanId,
      employeeId: user.employeeId,
      traineeId: user.traineeId,
    },
  });

  return {
    userId: user._id.toString(),
    role: user.role,
    humanId: user.humanId,
    employeeId: user.employeeId,
    traineeId: user.traineeId,
  };
}

export async function rejectCandidate(input: {
  candidateId: string;
  reason?: string;
  rejectedByUserId?: string;
}) {
  const user = await UserModel.findById(input.candidateId);
  if (!user) throw new ApiError(404, "Candidate not found");
  if (user.status !== "PENDING_APPROVAL")
    throw new ApiError(409, "Candidate is not pending approval");

  const fromStatus = user.status as UserStatus;
  user.status = "REJECTED";
  user.rejectedReason = input.reason;
  await user.save();

  if (input.rejectedByUserId) {
    await recordStatusChange({
      entityType: "USER",
      entityId: user._id.toString(),
      fromStatus,
      toStatus: "REJECTED",
      changedByUserId: input.rejectedByUserId,
      note: input.reason,
    });
  }
}
