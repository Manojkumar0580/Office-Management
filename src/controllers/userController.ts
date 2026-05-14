import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError";
import type { AdminCreatedRole, Role } from "../types/express";
import type { UserStatus } from "../models/User";
import { createUserByAdmin, listUsers, promoteUser } from "../services/userService";
import { creatableRolesFor } from "../utils/roleHierarchy";
import { userValidation } from "../validation/users.validation";
import { sendSuccess } from "../utils/apiResponse";

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
    sendSuccess(res, 201, "User account created successfully.", { user: result });
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
    sendSuccess(res, 200, "Users retrieved successfully.", { users });
  } catch (err) {
    next(err);
  }
}

export async function getCreatableRolesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { role } = requireAuth(req);
    sendSuccess(res, 200, "Creatable roles retrieved successfully.", {
      roles: creatableRolesFor(role),
    });
  } catch (err) {
    next(err);
  }
}

export async function promoteUserHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = requireAuth(req);
    const targetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await promoteUser({
      actorUserId: userId,
      actorRole: role,
      targetUserId: targetId,
      newRole: req.body.role as Role,
    });
    sendSuccess(res, 200, "User role updated successfully.", { user: result });
  } catch (err) {
    next(err);
  }
}

export const createUserSchema = userValidation.createUser;
export const listUsersSchema = userValidation.listUsers;
export const promoteUserSchema = userValidation.promoteUser;
