import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError";
import { authValidation } from "../validation/auth.validation";
import {
  bootstrapSuperAdmin,
  changePassword,
  login,
  registerCandidate,
} from "../services/authService";

// Re-export request validators for routes
export const registerStaffSchema = authValidation.registerStaff;
export const registerTraineeSchema = authValidation.registerTrainee;
export const loginSchema = authValidation.login;
export const changePasswordSchema = authValidation.changePassword;
export const bootstrapSchema = authValidation.bootstrapSuperAdmin;

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await registerCandidate({ ...req.body, role: "STAFF" });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function registerTrainee(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await registerCandidate({ ...req.body, role: "TRAINEE" });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

// Public-facing aliases so the form is named clearly. Behaviour is identical to the
// register endpoints; both create a PENDING_APPROVAL user that admin must approve.
export const submitTraineeApplication = registerTrainee;
export const submitStaffApplication = register;

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function changePasswordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth?.userId) throw new ApiError(401, "Unauthorized");
    await changePassword({
      userId: req.auth.userId,
      oldPassword: req.body.oldPassword,
      newPassword: req.body.newPassword,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function bootstrapSuperAdminHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await bootstrapSuperAdmin(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
