import type { NextFunction, Request, Response } from "express";
import path from "path";
import { ApiError } from "../utils/apiError";
import { normalizeUploadRelativePath } from "../utils/uploadUrls";
import {
  addCertificate,
  addCertificateFromBase64,
  requestProfileUpdate,
  reviewProfileUpdate,
  setLivePhoto,
  setLivePhotoFromBase64,
  setCV,
  setCVFromBase64,
} from "../services/staffProfileService";
import { StaffProfileModel } from "../models/StaffProfile";
import { ProfileChangeRequestModel } from "../models/ProfileChangeRequest";
import { staffProfileValidation } from "../validation/staffProfile.validation";
import { sendSuccess } from "../utils/apiResponse";

export async function getStaffProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const profile = await StaffProfileModel.findOne({ userId });
    sendSuccess(res, 200, "Staff profile retrieved successfully.", { profile });
  } catch (err) {
    next(err);
  }
}

export async function requestStaffProfileUpdate(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth?.userId) throw new ApiError(401, "Unauthorized");
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    // Staff can only request updates for themselves (unless super/admin)
    const isSelf = req.auth.userId === userId;
    const isPrivileged = req.auth.role === "SUPER_ADMIN" || req.auth.role === "ADMIN";
    if (!isSelf && !isPrivileged) throw new ApiError(403, "Forbidden");

    const reqDoc = await requestProfileUpdate({
      userId,
      requestedByUserId: req.auth.userId,
      changes: req.body,
    });

    sendSuccess(res, 201, "Profile update request submitted successfully.", { request: reqDoc });
  } catch (err) {
    next(err);
  }
}

export async function reviewStaffProfileUpdate(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth?.userId) throw new ApiError(401, "Unauthorized");
    const requestId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const result = await reviewProfileUpdate({
      requestId,
      approved: req.body.approved,
      reviewedByUserId: req.auth.userId,
      reason: req.body.reason,
    });
    sendSuccess(res, 200, result.message);
  } catch (err) {
    next(err);
  }
}

export async function listProfileChangeRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const status = (req.query.status as string | undefined) ?? "PENDING";
    const requests = await ProfileChangeRequestModel.find({ status })
      .sort({ createdAt: -1 })
      .limit(200);
    sendSuccess(res, 200, "Profile change requests retrieved successfully.", { requests });
  } catch (err) {
    next(err);
  }
}

export async function uploadLivePhoto(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new ApiError(400, "Missing file");
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const relativePath = normalizeUploadRelativePath(
      path.join("uploads", path.basename(req.file.path)),
    );
    const profile = await setLivePhoto(userId, relativePath);
    sendSuccess(res, 200, "Live photo updated successfully.", { profile });
  } catch (err) {
    next(err);
  }
}

export async function uploadCertificate(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new ApiError(400, "Missing file");
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const relativePath = normalizeUploadRelativePath(
      path.join("uploads", path.basename(req.file.path)),
    );
    const profile = await addCertificate(userId, { name: req.body.name, filePath: relativePath });
    sendSuccess(res, 200, "Document uploaded successfully.", { profile });
  } catch (err) {
    next(err);
  }
}

export async function uploadLivePhotoBase64(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const profile = await setLivePhotoFromBase64(userId, req.body.image);
    sendSuccess(res, 200, "Live photo updated successfully.", { profile });
  } catch (err) {
    next(err);
  }
}

export async function uploadCertificateBase64(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const profile = await addCertificateFromBase64(userId, {
      name: req.body.name,
      image: req.body.image,
    });
    sendSuccess(res, 200, "Document uploaded successfully.", { profile });
  } catch (err) {
    next(err);
  }
}

export async function uploadCV(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new ApiError(400, "Missing file");
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const relativePath = normalizeUploadRelativePath(
      path.join("uploads", path.basename(req.file.path)),
    );
    const profile = await setCV(userId, relativePath);
    sendSuccess(res, 200, "CV uploaded successfully.", { profile });
  } catch (err) {
    next(err);
  }
}

export async function uploadCVBase64(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const profile = await setCVFromBase64(userId, req.body.image);
    sendSuccess(res, 200, "CV uploaded successfully.", { profile });
  } catch (err) {
    next(err);
  }
}

// Re-export request validators for routes
export const staffIdParamsSchema = staffProfileValidation.staffIdParams;
export const profileUpdateSchema = staffProfileValidation.profileUpdate;
export const reviewSchema = staffProfileValidation.reviewRequest;
export const certificateSchema = staffProfileValidation.certificate;
export const livePhotoBase64Schema = staffProfileValidation.livePhotoBase64;
export const cvBase64Schema = staffProfileValidation.cvBase64;
export const certificateBase64Schema = staffProfileValidation.certificateBase64;
