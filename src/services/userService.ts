import mongoose from "mongoose";
import { ApiError } from "../utils/apiError";
import { UserModel, type UserStatus } from "../models/User";
import { StaffProfileModel } from "../models/StaffProfile";
import { TeamModel } from "../models/Team";
import { hashPassword } from "../utils/crypto";
import type { AdminCreatedRole, Role } from "../types/express";
import { nextHumanId, sequenceKeyForRole } from "./idService";
import { canCreateRole } from "../utils/roleHierarchy";
import { recordStatusChange } from "./statusLogService";
import { saveBase64Image, type Base64ImageInput } from "../utils/base64Image";

export type CreateUserByAdminInput = {
  // Performed by:
  actorUserId: string;
  actorRole: Role;

  // Account
  email: string;
  fullName: string;
  phone?: string;
  password: string;
  role: AdminCreatedRole;

  // Org structure
  teamId?: string;
  reportsToUserId?: string;

  // Profile
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

/**
 * Admin (or higher) creates a user directly. The user is ACTIVE immediately,
 * with the password the creator provided. No self-registration / approval flow.
 */
export async function createUserByAdmin(input: CreateUserByAdminInput) {
  if (!canCreateRole(input.actorRole, input.role)) {
    throw new ApiError(
      403,
      `Your role (${input.actorRole}) cannot create a user with role ${input.role}`,
    );
  }

  const existing = await UserModel.findOne({ email: input.email });
  if (existing) throw new ApiError(409, "Email already registered");

  if (input.teamId) {
    const team = await TeamModel.findById(input.teamId);
    if (!team) throw new ApiError(404, "Team not found");
    if (!team.isActive) throw new ApiError(409, "Team is inactive");
  }

  if (input.reportsToUserId) {
    if (!mongoose.isValidObjectId(input.reportsToUserId)) {
      throw new ApiError(400, "Invalid reportsToUserId");
    }
    const reportsTo = await UserModel.findById(input.reportsToUserId).select("_id");
    if (!reportsTo) throw new ApiError(404, "reportsToUserId user not found");
  }

  const passwordHash = await hashPassword(input.password);

  const seqKey = sequenceKeyForRole(input.role);
  const humanId = seqKey ? await nextHumanId(seqKey) : undefined;

  const user = await UserModel.create({
    email: input.email,
    fullName: input.fullName,
    phone: input.phone,
    role: input.role,
    status: "ACTIVE" satisfies UserStatus,
    passwordHash,
    mustChangePassword: false,
    humanId,
    teamId: input.teamId,
    reportsToUserId: input.reportsToUserId,
  });

  // Build profile (live photo + certificates etc.)
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
    toStatus: "ACTIVE",
    changedByUserId: input.actorUserId,
    note: "Created by admin",
    metadata: {
      role: user.role,
      humanId,
      teamId: input.teamId,
    },
  });

  return {
    id: user._id.toString(),
    role: user.role,
    humanId,
    teamId: input.teamId,
    status: user.status,
  };
}

export async function listUsers(input: {
  actorUserId: string;
  actorRole: Role;
  role?: Role;
  status?: UserStatus;
  teamId?: string;
}) {
  const filter: Record<string, unknown> = {};
  if (input.role) filter.role = input.role;
  if (input.status) filter.status = input.status;
  if (input.teamId) filter.teamId = input.teamId;

  // Scope: MANAGER and TL only see their own team's users.
  if (input.actorRole === "MANAGER" || input.actorRole === "TL") {
    const me = await UserModel.findById(input.actorUserId).select("_id teamId");
    if (!me?.teamId) return [];
    filter.teamId = me.teamId;
  }

  // STAFF / TRAINEE / CASHIER / CAPTAIN / ACCOUNTANT: only themselves.
  if (
    input.actorRole === "STAFF" ||
    input.actorRole === "TRAINEE" ||
    input.actorRole === "CASHIER" ||
    input.actorRole === "CAPTAIN" ||
    input.actorRole === "ACCOUNTANT"
  ) {
    filter._id = input.actorUserId;
  }

  return await UserModel.find(filter)
    .select(
      "_id email fullName phone role status employeeId traineeId humanId teamId reportsToUserId createdAt updatedAt",
    )
    .sort({ createdAt: -1 })
    .limit(500);
}
