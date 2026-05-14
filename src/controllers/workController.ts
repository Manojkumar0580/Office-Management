import type { NextFunction, Request, Response } from "express";
import path from "path";
import { ApiError } from "../utils/apiError";
import type { WorkStatus } from "../models/WorkItem";
import {
  addWorkAttachment,
  assignWork,
  dailyReport,
  getWork,
  listWork,
  reviewWork,
  submitWork,
} from "../services/workService";
import { workValidation } from "../validation/work.validation";
import { sendSuccess } from "../utils/apiResponse";

export async function assignHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.auth?.userId;
    if (!userId) throw new ApiError(401, "Unauthorized");
    const work = await assignWork({
      title: req.body.title,
      description: req.body.description,
      assignedByUserId: userId,
      assignedToUserId: req.body.assignedToUserId,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      images: req.body.images,
    });
    sendSuccess(res, 201, "Work assigned successfully.", { work });
  } catch (err) {
    next(err);
  }
}

export async function listHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const status = (req.query.status as WorkStatus | undefined) ?? undefined;
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;

    const items = await listWork({
      assignedToUserId: req.query.assignedToUserId as string | undefined,
      status,
      from,
      to,
    });
    sendSuccess(res, 200, "Work items retrieved successfully.", { items });
  } catch (err) {
    next(err);
  }
}

export async function getHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const work = await getWork(id);
    sendSuccess(res, 200, "Work item retrieved successfully.", { work });
  } catch (err) {
    next(err);
  }
}

export async function uploadAttachmentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new ApiError(400, "Missing file");
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const relativePath = path.join("uploads", path.basename(req.file.path));
    const work = await addWorkAttachment({
      workItemId: id,
      originalName: req.file.originalname,
      filePath: relativePath,
    });
    sendSuccess(res, 200, "Attachment uploaded successfully.", { work });
  } catch (err) {
    next(err);
  }
}

export async function submitHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.auth?.userId;
    if (!userId) throw new ApiError(401, "Unauthorized");
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await submitWork({
      workItemId: id,
      submittedByUserId: userId,
      note: req.body.note,
      images: req.body.images,
    });
    sendSuccess(res, 200, "Work submitted successfully.", result);
  } catch (err) {
    next(err);
  }
}

export async function reviewHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.auth?.userId;
    if (!userId) throw new ApiError(401, "Unauthorized");
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const work = await reviewWork({
      workItemId: id,
      reviewedByUserId: userId,
      approved: req.body.approved,
      note: req.body.note,
    });
    sendSuccess(res, 200, "Work review saved successfully.", { work });
  } catch (err) {
    next(err);
  }
}

export async function dailyReportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const report = await dailyReport({
      from: new Date(String(req.query.from)),
      to: new Date(String(req.query.to)),
    });
    sendSuccess(res, 200, "Daily work report generated successfully.", { report });
  } catch (err) {
    next(err);
  }
}

// Re-export request validators for routes
export const assignSchema = workValidation.assign;
export const listSchema = workValidation.list;
export const workIdParamsSchema = workValidation.workIdParams;
export const submitSchema = workValidation.submit;
export const reviewSchema = workValidation.review;
export const dailySchema = workValidation.dailyReport;
