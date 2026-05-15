import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError";
import type { ProjectStatus } from "../models/Project";
import {
  createProject,
  deactivateProject,
  getProject,
  getProjectProgress,
  getProjectOverview,
  getProjectSummary,
  listProjects,
  updateProject,
  updateProjectProgress,
} from "../services/projectService";
import { projectValidation } from "../validation/project.validation";
import { sendSuccess } from "../utils/apiResponse";
import { isProjectAdminRole } from "../utils/projectAccess";

function requireAuth(req: Request) {
  const userId = req.auth?.userId;
  const role = req.auth?.role;
  if (!userId || !role) throw new ApiError(401, "Unauthorized");
  return { userId, role };
}

export async function createProjectHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = requireAuth(req);
    const project = await createProject({
      name: req.body.name,
      description: req.body.description,
      clientName: req.body.clientName,
      status: req.body.status as ProjectStatus | undefined,
      budget: req.body.budget,
      revenue: req.body.revenue,
      currency: req.body.currency,
      startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
      endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      teamId: req.body.teamId,
      tlUserId: req.body.tlUserId,
      managerUserId: req.body.managerUserId,
      memberUserIds: req.body.memberUserIds,
      createdByUserId: userId,
      actorRole: role,
    });
    sendSuccess(res, 201, "Project created successfully.", { project });
  } catch (err) {
    next(err);
  }
}

export async function listProjectsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = requireAuth(req);
    const projects = await listProjects({
      status: req.query.status as ProjectStatus | undefined,
      teamId: req.query.teamId as string | undefined,
      tlUserId: req.query.tlUserId as string | undefined,
      managerUserId: req.query.managerUserId as string | undefined,
      clientName: req.query.clientName as string | undefined,
      from: req.query.from ? new Date(String(req.query.from)) : undefined,
      to: req.query.to ? new Date(String(req.query.to)) : undefined,
      includeInactive: req.query.includeInactive as boolean | undefined,
      actorUserId: userId,
      actorRole: role,
    });
    sendSuccess(res, 200, "Projects retrieved successfully.", { projects });
  } catch (err) {
    next(err);
  }
}

export async function getProjectHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = requireAuth(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await getProject(id, { actorUserId: userId, actorRole: role });
    sendSuccess(res, 200, "Project retrieved successfully.", { project });
  } catch (err) {
    next(err);
  }
}

export async function updateProjectHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = requireAuth(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await updateProject(id, {
      name: req.body.name,
      description: req.body.description,
      clientName: req.body.clientName,
      status: req.body.status as ProjectStatus | undefined,
      budget: req.body.budget,
      revenue: req.body.revenue,
      currency: req.body.currency,
      startDate:
        req.body.startDate === null
          ? null
          : req.body.startDate
            ? new Date(req.body.startDate)
            : undefined,
      endDate:
        req.body.endDate === null
          ? null
          : req.body.endDate
            ? new Date(req.body.endDate)
            : undefined,
      teamId: req.body.teamId,
      tlUserId: req.body.tlUserId,
      managerUserId: req.body.managerUserId,
      memberUserIds: req.body.memberUserIds,
      updatedByUserId: userId,
      actorRole: role,
    });
    sendSuccess(res, 200, "Project updated successfully.", { project });
  } catch (err) {
    next(err);
  }
}

export async function deleteProjectHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = requireAuth(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await deactivateProject(id, userId, role);
    sendSuccess(res, 200, "Project deactivated successfully.", { project });
  } catch (err) {
    next(err);
  }
}

export async function getProjectProgressHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = requireAuth(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const progress = await getProjectProgress(id, userId, role);
    sendSuccess(res, 200, "Project work progress retrieved successfully.", progress);
  } catch (err) {
    next(err);
  }
}

export async function updateProjectProgressHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { userId, role } = requireAuth(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await updateProjectProgress(id, {
      percent: req.body.percent,
      note: req.body.note,
      updatedByUserId: userId,
      actorRole: role,
    });
    sendSuccess(res, 200, "Project work progress updated successfully.", result);
  } catch (err) {
    next(err);
  }
}

export async function projectOverviewHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = requireAuth(req);
    let tlUserId = req.query.tlUserId as string | undefined;
    if ((role === "TL" || role === "CAPTAIN") && !isProjectAdminRole(role)) {
      tlUserId = userId;
    }
    const overview = await getProjectOverview({
      from: req.query.from ? new Date(String(req.query.from)) : undefined,
      to: req.query.to ? new Date(String(req.query.to)) : undefined,
      tlUserId,
      status: req.query.status as ProjectStatus | undefined,
      actorUserId: userId,
      actorRole: role,
    });
    sendSuccess(res, 200, "Project overview retrieved successfully.", { overview });
  } catch (err) {
    next(err);
  }
}

export async function projectSummaryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = requireAuth(req);
    let tlUserId = req.query.tlUserId as string | undefined;
    if ((role === "TL" || role === "CAPTAIN") && !isProjectAdminRole(role)) {
      tlUserId = userId;
    }
    const summary = await getProjectSummary({
      from: req.query.from ? new Date(String(req.query.from)) : undefined,
      to: req.query.to ? new Date(String(req.query.to)) : undefined,
      tlUserId,
    });
    sendSuccess(res, 200, "Project summary retrieved successfully.", { summary });
  } catch (err) {
    next(err);
  }
}

export const createProjectSchema = projectValidation.createProject;
export const updateProjectSchema = projectValidation.updateProject;
export const updateProgressSchema = projectValidation.updateProgress;
export const projectIdParamsSchema = projectValidation.projectIdParams;
export const listProjectsSchema = projectValidation.listProjects;
export const projectSummarySchema = projectValidation.summaryReport;
export const projectOverviewSchema = projectValidation.overviewReport;
