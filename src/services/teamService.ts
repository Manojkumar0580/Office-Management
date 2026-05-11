import mongoose from "mongoose";
import { ApiError } from "../utils/apiError";
import { TeamModel } from "../models/Team";
import { UserModel } from "../models/User";
import type { Role } from "../types/express";

export async function createTeam(input: {
  name: string;
  description?: string;
  managerUserId?: string;
  leadUserId?: string;
  createdByUserId: string;
}) {
  if (input.managerUserId && !mongoose.isValidObjectId(input.managerUserId)) {
    throw new ApiError(400, "Invalid managerUserId");
  }
  if (input.leadUserId && !mongoose.isValidObjectId(input.leadUserId)) {
    throw new ApiError(400, "Invalid leadUserId");
  }

  if (input.managerUserId) {
    const m = await UserModel.findById(input.managerUserId).select("_id role");
    if (!m) throw new ApiError(404, "Manager user not found");
    if (m.role !== "MANAGER" && m.role !== "ADMIN" && m.role !== "SUPER_ADMIN") {
      throw new ApiError(400, "managerUserId must be a MANAGER (or higher)");
    }
  }
  if (input.leadUserId) {
    const l = await UserModel.findById(input.leadUserId).select("_id role");
    if (!l) throw new ApiError(404, "Lead user not found");
    if (l.role !== "TL" && l.role !== "CAPTAIN") {
      throw new ApiError(400, "leadUserId must be a TL or CAPTAIN");
    }
  }

  return await TeamModel.create({
    name: input.name,
    description: input.description,
    managerUserId: input.managerUserId,
    leadUserId: input.leadUserId,
    createdByUserId: input.createdByUserId,
  });
}

export async function updateTeam(
  teamId: string,
  input: {
    name?: string;
    description?: string;
    managerUserId?: string | null;
    leadUserId?: string | null;
    isActive?: boolean;
  },
) {
  const team = await TeamModel.findById(teamId);
  if (!team) throw new ApiError(404, "Team not found");

  if (input.name !== undefined) team.name = input.name;
  if (input.description !== undefined) team.description = input.description;
  if (input.managerUserId !== undefined) team.managerUserId = input.managerUserId ?? undefined;
  if (input.leadUserId !== undefined) team.leadUserId = input.leadUserId ?? undefined;
  if (input.isActive !== undefined) team.isActive = input.isActive;

  await team.save();
  return team;
}

export async function listTeams(input: { actorUserId: string; actorRole: Role }) {
  // Manager / TL only see their team(s).
  if (input.actorRole === "MANAGER") {
    return await TeamModel.find({ managerUserId: input.actorUserId }).sort({ createdAt: -1 });
  }
  if (input.actorRole === "TL" || input.actorRole === "CAPTAIN") {
    return await TeamModel.find({ leadUserId: input.actorUserId }).sort({ createdAt: -1 });
  }
  return await TeamModel.find({}).sort({ createdAt: -1 }).limit(500);
}

export async function getTeam(teamId: string) {
  const team = await TeamModel.findById(teamId);
  if (!team) throw new ApiError(404, "Team not found");
  return team;
}

export async function assignUserToTeam(input: {
  userId: string;
  teamId: string | null;
  reportsToUserId?: string | null;
}) {
  const user = await UserModel.findById(input.userId);
  if (!user) throw new ApiError(404, "User not found");

  if (input.teamId) {
    const team = await TeamModel.findById(input.teamId);
    if (!team) throw new ApiError(404, "Team not found");
    if (!team.isActive) throw new ApiError(409, "Team is inactive");
    user.teamId = team._id;
  } else if (input.teamId === null) {
    user.teamId = undefined;
  }

  if (input.reportsToUserId !== undefined) {
    user.reportsToUserId = input.reportsToUserId ?? undefined;
  }

  await user.save();
  return user;
}
