import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError";
import { authValidation } from "../validation/auth.validation";
import {
  bootstrapSuperAdmin,
  changePassword,
  login,
  registerCandidate,
  requestPasswordReset,
  resetPasswordWithOtp,
  updatePendingApplication,
} from "../services/authService";
import { sendSuccess } from "../utils/apiResponse";

// Re-export request validators for routes
export const registerStaffSchema = authValidation.registerStaff;
export const registerTraineeSchema = authValidation.registerTrainee;
export const loginSchema = authValidation.login;
export const changePasswordSchema = authValidation.changePassword;
export const bootstrapSchema = authValidation.bootstrapSuperAdmin;
export const patchApplicationSchema = authValidation.patchApplication;
export const forgotPasswordSchema = authValidation.forgotPassword;
export const resetPasswordSchema = authValidation.resetPassword;

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await registerCandidate({ ...req.body, role: "STAFF" });
    sendSuccess(res, 201, result.message, {
      id: result.id,
      status: result.status,
      role: result.role,
    });
  } catch (err) {
    next(err);
  }
}

export async function registerTrainee(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await registerCandidate({ ...req.body, role: "TRAINEE" });
    sendSuccess(res, 201, result.message, {
      id: result.id,
      status: result.status,
      role: result.role,
    });
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
    sendSuccess(res, 200, "Signed in successfully.", result);
  } catch (err) {
    next(err);
  }
}

export async function forgotPasswordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await requestPasswordReset({ email: req.body.email });
    sendSuccess(res, 200, result.message);
  } catch (err) {
    next(err);
  }
}

export async function resetPasswordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await resetPasswordWithOtp({
      email: req.body.email,
      otp: req.body.otp,
      newPassword: req.body.newPassword,
    });
    sendSuccess(res, 200, result.message);
  } catch (err) {
    next(err);
  }
}

export async function patchMyApplication(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth?.userId) throw new ApiError(401, "Unauthorized");
    const result = await updatePendingApplication({
      userId: req.auth.userId,
      ...req.body,
    });
    sendSuccess(res, 200, result.message, {
      id: result.id,
      status: result.status,
      role: result.role,
    });
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
    sendSuccess(res, 200, "Your password has been changed successfully.");
  } catch (err) {
    next(err);
  }
}

export async function bootstrapSuperAdminHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await bootstrapSuperAdmin(req.body);
    sendSuccess(res, 201, "Super admin account created successfully.", { id: result.id });
  } catch (err) {
    next(err);
  }
}
