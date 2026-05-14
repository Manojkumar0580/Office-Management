import mongoose from "mongoose";
import { ApiError } from "../utils/apiError";
import { UserModel, type UserDoc, type UserStatus } from "../models/User";
import { StaffProfileModel } from "../models/StaffProfile";
import { TeamModel } from "../models/Team";
import { hashPassword } from "../utils/crypto";
import type { AdminCreatedRole, Role } from "../types/express";
import { nextHumanId, sequenceKeyForRole } from "./idService";
import { canCreateRole, canPromoteUser } from "../utils/roleHierarchy";
import { recordStatusChange } from "./statusLogService";
import { saveBase64Image, type Base64ImageInput } from "../utils/base64Image";
import { syncAdminRecordForUser } from "./adminRecordService";

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

  await syncAdminRecordForUser(user._id.toString(), user.role as Role);

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

async function applyRoleIdentifiers(user: UserDoc, newRole: Role) {
  user.employeeId = undefined;
  user.traineeId = undefined;

  if (newRole === "STAFF") {
    const key = sequenceKeyForRole("STAFF");
    if (!key) throw new ApiError(500, "No id sequence for STAFF");
    const id = await nextHumanId(key);
    user.humanId = id;
    user.employeeId = id;
    return;
  }
  if (newRole === "TRAINEE") {
    const id = await nextHumanId("TRAINEE");
    user.humanId = id;
    user.traineeId = id;
    return;
  }
  if (newRole === "SUPER_ADMIN") {
    user.humanId = undefined;
    return;
  }

  const seqKey = sequenceKeyForRole(newRole);
  if (seqKey) {
    user.humanId = await nextHumanId(seqKey);
  } else {
    user.humanId = undefined;
  }
}

/**
 * Change an active user's role. SUPER_ADMIN may set any role manually (including another SUPER_ADMIN).
 * Other roles follow strict promotion rules (`canPromoteUser`).
 */
export async function promoteUser(input: {
  actorUserId: string;
  actorRole: Role;
  targetUserId: string;
  newRole: Role;
}) {
  if (input.actorUserId === input.targetUserId) {
    throw new ApiError(400, "You cannot change your own role");
  }

  const subject = await UserModel.findById(input.targetUserId);
  if (!subject) throw new ApiError(404, "User not found");
  if (subject.status !== "ACTIVE") {
    throw new ApiError(409, "Only active users can be assigned a different role");
  }

  const fromRole = subject.role as Role;
  const toRole = input.newRole;

  if (fromRole === toRole) {
    throw new ApiError(409, "User already has this role");
  }

  if (toRole === "SUPER_ADMIN" && input.actorRole !== "SUPER_ADMIN") {
    throw new ApiError(403, "Only Super Admin can assign the SUPER_ADMIN role");
  }

  if (input.actorRole === "SUPER_ADMIN") {
    // Manual assignment: any valid role transition.
  } else if (!canPromoteUser(input.actorRole, fromRole, toRole)) {
    throw new ApiError(
      403,
      "You cannot assign this role change. Super Admin may set any role manually.",
    );
  }

  if (input.actorRole === "MANAGER" || input.actorRole === "TL") {
    const actor = await UserModel.findById(input.actorUserId).select("teamId");
    if (!actor?.teamId || String(subject.teamId ?? "") !== String(actor.teamId)) {
      throw new ApiError(403, "You can only change roles for users on your team");
    }
  }

  subject.role = toRole;
  await applyRoleIdentifiers(subject, toRole);
  await subject.save();

  await recordStatusChange({
    entityType: "USER",
    entityId: subject._id.toString(),
    fromStatus: fromRole,
    toStatus: toRole,
    changedByUserId: input.actorUserId,
    note: input.actorRole === "SUPER_ADMIN" ? "Role set manually" : "User promoted",
    metadata: { fromRole, toRole },
  });

  await syncAdminRecordForUser(subject._id.toString(), toRole);

  return {
    id: subject._id.toString(),
    role: subject.role,
    humanId: subject.humanId,
    employeeId: subject.employeeId,
    traineeId: subject.traineeId,
    status: subject.status,
  };
}
