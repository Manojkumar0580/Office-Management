import type { Request, Response, NextFunction } from "express";
import { approveCandidate, rejectCandidate } from "../services/authService";
import { UserModel } from "../models/User";
import { ApiError } from "../utils/apiError";
import { staffValidation } from "../validation/staff.validation";
import type { Role } from "../types/express";
import { sendSuccess } from "../utils/apiResponse";

export async function reviewStaff(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth?.userId) throw new ApiError(401, "Unauthorized");
    const candidateId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (req.body.status === "APPROVED") {
      const result = await approveCandidate({
        candidateId,
        approvedByUserId: req.auth.userId,
      });
      sendSuccess(res, 200, "Application approved successfully.", result);
      return;
    }

    await rejectCandidate({
      candidateId,
      reason: req.body.reason,
      rejectedByUserId: req.auth.userId,
    });
    sendSuccess(res, 200, "Application rejected.");
  } catch (err) {
    next(err);
  }
}

export async function listStaff(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth?.userId || !req.auth?.role) throw new ApiError(401, "Unauthorized");

    const status = req.query.status as string | undefined;
    const role = req.query.role as string | undefined;

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (role) filter.role = role;

    // Scope: MANAGER and TL only see their own team.
    const actorRole = req.auth.role as Role;
    if (actorRole === "MANAGER" || actorRole === "TL") {
      const me = await UserModel.findById(req.auth.userId).select("_id teamId");
      if (!me?.teamId) {
        sendSuccess(res, 200, "No team assigned; staff list is empty.", { users: [] });
        return;
      }
      filter.teamId = me.teamId;
    }

    const users = await UserModel.find(filter)
      .select(
        "_id email fullName phone role status employeeId traineeId humanId teamId reportsToUserId createdAt updatedAt",
      )
      .sort({ createdAt: -1 })
      .limit(500);

    sendSuccess(res, 200, "Staff list retrieved successfully.", { users });
  } catch (err) {
    next(err);
  }
}

// Re-export request validators for routes
export const staffIdParamsSchema = staffValidation.staffIdParams;
export const staffReviewBodySchema = staffValidation.reviewBody;
