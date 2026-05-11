import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError";
import type { AdminCreatedRole, Role } from "../types/express";
import type { UserStatus } from "../models/User";
import { createUserByAdmin, listUsers } from "../services/userService";
import { creatableRolesFor } from "../utils/roleHierarchy";
import { userValidation } from "../validation/users.validation";

function requireAuth(req: Request) {
  if (!req.auth?.userId || !req.auth?.role) {
    throw new ApiError(401, "Unauthorized");
  }
  return { userId: req.auth.userId, role: req.auth.role };
}

export async function createUserHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = requireAuth(req);
    const result = await createUserByAdmin({
      actorUserId: userId,
      actorRole: role,
      email: req.body.email,
      fullName: req.body.fullName,
      phone: req.body.phone,
      password: req.body.password,
      role: req.body.role as AdminCreatedRole,
      teamId: req.body.teamId,
      reportsToUserId: req.body.reportsToUserId,
      aadharNumberLast4: req.body.aadharNumberLast4,
      additionalDetails: req.body.additionalDetails,
      professional: req.body.professional,
      livePhoto: req.body.livePhoto,
      certificates: req.body.certificates,
    });
    res.status(201).json({ user: result });
  } catch (err) {
    next(err);
  }
}

export async function listUsersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = requireAuth(req);
    const users = await listUsers({
      actorUserId: userId,
      actorRole: role,
      role: req.query.role as Role | undefined,
      status: req.query.status as UserStatus | undefined,
      teamId: req.query.teamId as string | undefined,
    });
    res.json({ users });
  } catch (err) {
    next(err);
  }
}

export async function getCreatableRolesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { role } = requireAuth(req);
    res.json({ roles: creatableRolesFor(role) });
  } catch (err) {
    next(err);
  }
}

export const createUserSchema = userValidation.createUser;
export const listUsersSchema = userValidation.listUsers;
