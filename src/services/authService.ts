import jwt from "jsonwebtoken";
import { ApiError } from "../utils/apiError";
import { UserModel, type UserStatus } from "../models/User";
import { StaffProfileModel } from "../models/StaffProfile";
import {
  hashPassword,
  hashPasswordResetOtp,
  randomSixDigitOtp,
  verifyPassword,
} from "../utils/crypto";
import type { Role } from "../types/express";
import { nextHumanId, sequenceKeyForRole } from "./idService";
import { recordStatusChange } from "./statusLogService";
import { saveBase64Image, type Base64ImageInput } from "../utils/base64Image";
import { PasswordResetTokenModel } from "../models/PasswordResetToken";
import { sendAccountApprovedEmail, sendPasswordResetOtp } from "./mailService";
import { syncAdminRecordForUser } from "./adminRecordService";

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

  await syncAdminRecordForUser(user._id.toString(), "SUPER_ADMIN");

  return { id: user._id.toString() };
}

export async function login(input: { email: string; password: string }) {
  const user = await UserModel.findOne({ email: input.email });
  if (!user) throw new ApiError(401, "Invalid email or password");

  const isDraftApplicant =
    user.status === "PENDING_APPROVAL" && (user.role === "STAFF" || user.role === "TRAINEE");
  if (user.status !== "ACTIVE" && !isDraftApplicant) {
    throw new ApiError(403, `Account is not active (${user.status})`);
  }

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw new ApiError(401, "Invalid email or password");

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new ApiError(500, "JWT_SECRET not configured");

  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, secret, {
    expiresIn: "7d",
  });

  return {
    token,
    mustChangePassword: user.mustChangePassword,
    role: user.role,
    status: user.status,
  };
}

export type UpdatePendingApplicationInput = Omit<Partial<RegisterCandidateInput>, "role"> & {
  userId: string;
};

/**
 * Self-service edits to a staff/trainee registration before approval.
 * Allowed only while user.status is PENDING_APPROVAL (draft). No updates after approval (ACTIVE).
 */
export async function updatePendingApplication(input: UpdatePendingApplicationInput) {
  const user = await UserModel.findById(input.userId);
  if (!user) throw new ApiError(404, "User not found");
  if (user.status !== "PENDING_APPROVAL") {
    throw new ApiError(
      409,
      "Application details can only be updated while the application is in draft (pending approval).",
    );
  }
  if (user.role !== "STAFF" && user.role !== "TRAINEE") {
    throw new ApiError(403, "This application cannot be updated through this endpoint.");
  }

  if (input.email !== undefined && input.email.trim().toLowerCase() !== user.email) {
    const taken = await UserModel.findOne({
      email: input.email.trim().toLowerCase(),
      _id: { $ne: user._id },
    });
    if (taken) throw new ApiError(409, "Email already registered");
    user.email = input.email.trim().toLowerCase();
  }
  if (input.fullName !== undefined) user.fullName = input.fullName.trim();
  if (input.phone !== undefined) user.phone = input.phone;
  if (input.password !== undefined) {
    user.passwordHash = await hashPassword(input.password);
  }
  await user.save();

  const profile = await StaffProfileModel.findOne({ userId: user._id });
  if (!profile) throw new ApiError(404, "Application profile not found");

  if (input.aadharNumberLast4 !== undefined) profile.aadharNumberLast4 = input.aadharNumberLast4;

  if (input.additionalDetails !== undefined) {
    profile.additionalDetails = {
      ...profile.additionalDetails,
      ...input.additionalDetails,
    };
  }

  if (input.livePhoto) {
    const livePhotoSaved = saveBase64Image(input.livePhoto);
    profile.livePhotoPath = livePhotoSaved.filePath;
  }

  if (input.professional !== undefined || input.certificates !== undefined) {
    const prev = profile.professional ?? {};
    let certificates = prev.certificates ?? [];
    if (input.certificates !== undefined) {
      certificates = input.certificates.map((c) => {
        const img = saveBase64Image(c.image);
        return {
          name: c.name,
          filePath: img.filePath,
          uploadedAt: img.uploadedAt,
        };
      });
    }
    profile.professional = {
      qualification:
        input.professional?.qualification !== undefined
          ? input.professional.qualification
          : prev.qualification,
      experienceSummary:
        input.professional?.experienceSummary !== undefined
          ? input.professional.experienceSummary
          : prev.experienceSummary,
      certificates,
    };
  }

  await profile.save();

  return {
    id: user._id.toString(),
    status: user.status,
    role: user.role,
    message: "Application updated.",
  };
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

const PASSWORD_RESET_OTP_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_MAX_OTP_ATTEMPTS = 5;

/** Same response whether or not the email exists (prevents account enumeration). */
const FORGOT_PASSWORD_SUCCESS_MESSAGE =
  "If an account exists for this email, a 6-digit verification code has been sent. It is valid for 10 minutes. Check your inbox and spam folder.";

function passwordResetAllowedStatus(status: UserStatus) {
  return status === "ACTIVE" || status === "PENDING_APPROVAL";
}

/**
 * Forgot password: always returns the same success payload (no email enumeration).
 * Persists a hashed OTP and emails the plain code when SMTP is configured.
 */
export async function requestPasswordReset(input: { email: string }) {
  const email = input.email.trim().toLowerCase();
  const user = await UserModel.findOne({ email });
  if (!user || !passwordResetAllowedStatus(user.status as UserStatus)) {
    return { message: FORGOT_PASSWORD_SUCCESS_MESSAGE };
  }

  await PasswordResetTokenModel.deleteMany({ userId: user._id });

  const otp = randomSixDigitOtp();
  const otpHash = hashPasswordResetOtp(user._id.toString(), email, otp);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_TTL_MS);
  const expiresMinutes = PASSWORD_RESET_OTP_TTL_MS / 60_000;

  await PasswordResetTokenModel.create({
    userId: user._id,
    otpHash,
    expiresAt,
    attempts: 0,
  });

  try {
    await sendPasswordResetOtp(user.email, otp, expiresMinutes);
  } catch (err) {
    await PasswordResetTokenModel.deleteMany({ userId: user._id });
    console.error(
      "[password-reset] Unable to send the verification email. Please try again later or contact support if the problem continues.",
      err,
    );
  }

  return { message: FORGOT_PASSWORD_SUCCESS_MESSAGE };
}

export async function resetPasswordWithOtp(input: {
  email: string;
  otp: string;
  newPassword: string;
}) {
  const email = input.email.trim().toLowerCase();
  const otpDigits = input.otp.replace(/\D/g, "").slice(0, 6);
  if (otpDigits.length !== 6) {
    throw new ApiError(
      400,
      "Please enter the 6-digit verification code exactly as it appears in the email we sent you.",
    );
  }

  const user = await UserModel.findOne({ email });
  if (!user || !passwordResetAllowedStatus(user.status as UserStatus)) {
    throw new ApiError(
      400,
      "We could not reset your password with the information provided. Check the email address, request a new verification code, or contact support if you need help.",
    );
  }

  const entry = await PasswordResetTokenModel.findOne({ userId: user._id }).sort({ createdAt: -1 });
  if (!entry || entry.expiresAt.getTime() < Date.now()) {
    throw new ApiError(
      400,
      "This verification code has expired or is no longer valid. Please use Forgot password again to receive a new code.",
    );
  }

  const expectedHash = hashPasswordResetOtp(user._id.toString(), email, otpDigits);
  if (entry.otpHash !== expectedHash) {
    entry.attempts = (entry.attempts ?? 0) + 1;
    if (entry.attempts >= PASSWORD_RESET_MAX_OTP_ATTEMPTS) {
      await PasswordResetTokenModel.deleteOne({ _id: entry._id });
      throw new ApiError(
        400,
        "Too many incorrect verification attempts. For your security, please use Forgot password again to receive a new code.",
      );
    }
    await entry.save();
    throw new ApiError(
      400,
      "The verification code you entered is incorrect. Please check the code in your email and try again.",
    );
  }

  user.passwordHash = await hashPassword(input.newPassword);
  user.mustChangePassword = false;
  await user.save();

  await PasswordResetTokenModel.deleteMany({ userId: user._id });

  return {
    message:
      "Your password has been updated successfully. You can now sign in with your new password.",
  };
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

  void sendAccountApprovedEmail(user.email, {
    fullName: user.fullName,
    role: String(user.role),
    employeeId: user.employeeId,
    traineeId: user.traineeId,
    humanId: user.humanId,
  }).catch((err: unknown) => {
    console.error("[mail] account approved notification failed:", err);
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
