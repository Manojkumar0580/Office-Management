import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError";
import {
  assignUserToTeam,
  createTeam,
  getTeam,
  listTeams,
  updateTeam,
} from "../services/teamService";
import { teamValidation } from "../validation/team.validation";

function requireAuth(req: Request) {
  if (!req.auth?.userId || !req.auth?.role) {
    throw new ApiError(401, "Unauthorized");
  }
  return { userId: req.auth.userId, role: req.auth.role };
}

export async function createTeamHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = requireAuth(req);
    const team = await createTeam({
      name: req.body.name,
      description: req.body.description,
      managerUserId: req.body.managerUserId,
      leadUserId: req.body.leadUserId,
      createdByUserId: userId,
    });
    res.status(201).json({ team });
  } catch (err) {
    next(err);
  }
}

export async function updateTeamHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const team = await updateTeam(id, req.body);
    res.json({ team });
  } catch (err) {
    next(err);
  }
}

export async function listTeamsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = requireAuth(req);
    const teams = await listTeams({ actorUserId: userId, actorRole: role });
    res.json({ teams });
  } catch (err) {
    next(err);
  }
}

export async function getTeamHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const team = await getTeam(id);
    res.json({ team });
  } catch (err) {
    next(err);
  }
}

export async function assignUserToTeamHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await assignUserToTeam({
      userId: req.body.userId,
      teamId: req.body.teamId,
      reportsToUserId: req.body.reportsToUserId,
    });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export const createTeamSchema = teamValidation.createTeam;
export const updateTeamSchema = teamValidation.updateTeam;
export const teamIdParamsSchema = teamValidation.teamIdParams;
export const assignUserSchema = teamValidation.assignUser;
