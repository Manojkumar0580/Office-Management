import mongoose, { type HydratedDocument } from "mongoose";
import { ApiError } from "../utils/apiError";
import { ProjectModel, type ProjectDoc, type ProjectStatus } from "../models/Project";
import { TeamModel } from "../models/Team";
import { UserModel } from "../models/User";
import { recordStatusChange } from "./statusLogService";
import {
  canAccessProjectProgress,
  canViewAllProjectsProgress,
  isProjectAdminRole,
} from "../utils/projectAccess";
import type { Role } from "../types/express";

const PROJECT_POPULATE = [
  { path: "teamId", select: "name" },
  { path: "tlUserId", select: "fullName email role employeeId humanId" },
  { path: "managerUserId", select: "fullName email role" },
  { path: "memberUserIds", select: "fullName email role employeeId traineeId status" },
  { path: "workProgress.updatedByUserId", select: "fullName email role" },
];

const MEMBER_ROLES = ["STAFF", "TRAINEE", "TL", "CAPTAIN", "CASHIER"] as const;

async function nextProjectCode(): Promise<string> {
  const count = await ProjectModel.countDocuments();
  return `PRJ-${String(count + 1).padStart(4, "0")}`;
}

async function validateTlUserId(tlUserId?: string) {
  if (!tlUserId) return;
  if (!mongoose.isValidObjectId(tlUserId)) throw new ApiError(400, "Invalid tlUserId");
  const tl = await UserModel.findById(tlUserId).select("_id role status");
  if (!tl) throw new ApiError(404, "TL user not found");
  if (tl.status !== "ACTIVE") throw new ApiError(400, "TL user is not active");
  if (tl.role !== "TL" && tl.role !== "CAPTAIN") {
    throw new ApiError(400, "tlUserId must be a TL or CAPTAIN");
  }
}

async function validateTeamAndManager(input: { teamId?: string; managerUserId?: string }) {
  if (input.teamId) {
    if (!mongoose.isValidObjectId(input.teamId)) throw new ApiError(400, "Invalid teamId");
    const team = await TeamModel.findById(input.teamId).select("_id isActive leadUserId");
    if (!team) throw new ApiError(404, "Team not found");
    if (!team.isActive) throw new ApiError(400, "Team is not active");
  }
  if (input.managerUserId) {
    if (!mongoose.isValidObjectId(input.managerUserId)) {
      throw new ApiError(400, "Invalid managerUserId");
    }
    const manager = await UserModel.findById(input.managerUserId).select("_id role status");
    if (!manager) throw new ApiError(404, "Manager user not found");
    if (manager.status !== "ACTIVE") throw new ApiError(400, "Manager user is not active");
    const allowed = ["MANAGER", "ADMIN", "SUPER_ADMIN", "TL", "CAPTAIN"];
    if (!allowed.includes(manager.role)) {
      throw new ApiError(400, "managerUserId must be a MANAGER, TL, CAPTAIN, or higher");
    }
  }
}

async function validateMemberUserIds(memberUserIds?: string[]) {
  if (!memberUserIds?.length) return;
  const unique = [...new Set(memberUserIds)];
  for (const id of unique) {
    if (!mongoose.isValidObjectId(id)) throw new ApiError(400, `Invalid member user id: ${id}`);
  }
  const users = await UserModel.find({ _id: { $in: unique } }).select("_id role status");
  if (users.length !== unique.length) throw new ApiError(404, "One or more member users not found");
  for (const u of users) {
    if (u.status !== "ACTIVE") throw new ApiError(400, "All project members must be ACTIVE users");
    if (!MEMBER_ROLES.includes(u.role as (typeof MEMBER_ROLES)[number])) {
      throw new ApiError(400, `User ${u._id} cannot be assigned as a project member`);
    }
  }
}

function memberIdsToObjectIds(ids?: string[]) {
  if (!ids?.length) return [];
  return [...new Set(ids)].map((id) => new mongoose.Types.ObjectId(id));
}

export type ProjectViewOptions = {
  actorUserId: string;
  actorRole: Role;
};

export function serializeProject(
  project: HydratedDocument<ProjectDoc>,
  options: ProjectViewOptions,
) {
  const doc = project.toObject({ virtuals: false }) as Record<string, unknown>;
  const memberUserIds = doc.memberUserIds ?? [];
  const memberCount = Array.isArray(memberUserIds) ? memberUserIds.length : 0;
  const showProgress = canAccessProjectProgress(
    options.actorRole,
    options.actorUserId,
    doc.tlUserId?.toString(),
  );

  const { workProgress, ...rest } = doc;
  return {
    ...rest,
    memberCount,
    ...(showProgress ? { workProgress } : {}),
  };
}

async function findProjectById(projectId: string) {
  if (!mongoose.isValidObjectId(projectId)) throw new ApiError(400, "Invalid project id");
  const project = await ProjectModel.findById(projectId).populate(PROJECT_POPULATE);
  if (!project || !project.isActive) throw new ApiError(404, "Project not found");
  return project;
}

function assertCanManageMembers(actorRole: Role, actorUserId: string, project: ProjectDoc) {
  if (isProjectAdminRole(actorRole) || actorRole === "MANAGER") return;
  if (
    (actorRole === "TL" || actorRole === "CAPTAIN") &&
    project.tlUserId?.toString() === actorUserId
  ) {
    return;
  }
  throw new ApiError(403, "Forbidden");
}

function assertCanViewProgress(actorRole: Role, actorUserId: string, project: ProjectDoc) {
  if (!canAccessProjectProgress(actorRole, actorUserId, project.tlUserId?.toString())) {
    throw new ApiError(403, "Only the project TL or an admin can view work progress");
  }
}

export async function createProject(input: {
  name: string;
  description?: string;
  clientName?: string;
  status?: ProjectStatus;
  budget?: number;
  revenue?: number;
  currency?: string;
  startDate?: Date;
  endDate?: Date;
  teamId?: string;
  tlUserId?: string;
  managerUserId?: string;
  memberUserIds?: string[];
  createdByUserId: string;
  actorRole: Role;
}) {
  await validateTeamAndManager(input);
  await validateTlUserId(input.tlUserId);
  await validateMemberUserIds(input.memberUserIds);

  const code = await nextProjectCode();
  const status = input.status ?? "PLANNED";

  const project = await ProjectModel.create({
    code,
    name: input.name,
    description: input.description,
    clientName: input.clientName,
    status,
    budget: input.budget,
    revenue: input.revenue ?? 0,
    currency: input.currency ?? "INR",
    startDate: input.startDate,
    endDate: input.endDate,
    teamId: input.teamId,
    tlUserId: input.tlUserId,
    managerUserId: input.managerUserId,
    memberUserIds: memberIdsToObjectIds(input.memberUserIds),
    createdByUserId: input.createdByUserId,
  });

  await recordStatusChange({
    entityType: "PROJECT",
    entityId: project._id.toString(),
    toStatus: status,
    changedByUserId: input.createdByUserId,
    metadata: {
      code: project.code,
      tlUserId: input.tlUserId,
      memberCount: input.memberUserIds?.length ?? 0,
    },
  });

  await project.populate(PROJECT_POPULATE);
  return serializeProject(project, {
    actorUserId: input.createdByUserId,
    actorRole: input.actorRole,
  });
}

export async function listProjects(input: {
  status?: ProjectStatus;
  teamId?: string;
  tlUserId?: string;
  managerUserId?: string;
  clientName?: string;
  from?: Date;
  to?: Date;
  includeInactive?: boolean;
  actorUserId: string;
  actorRole: Role;
}) {
  const filter: Record<string, unknown> = {};
  if (!input.includeInactive) filter.isActive = true;
  if (input.status) filter.status = input.status;
  if (input.teamId) filter.teamId = input.teamId;
  if (input.managerUserId) filter.managerUserId = input.managerUserId;
  if (input.clientName) {
    filter.clientName = { $regex: input.clientName, $options: "i" };
  }
  if (input.from || input.to) {
    filter.createdAt = {
      ...(input.from ? { $gte: input.from } : {}),
      ...(input.to ? { $lte: input.to } : {}),
    };
  }

  if (input.tlUserId) {
    filter.tlUserId = input.tlUserId;
  } else if (input.actorRole === "TL" || input.actorRole === "CAPTAIN") {
    if (!isProjectAdminRole(input.actorRole)) {
      filter.tlUserId = input.actorUserId;
    }
  }

  const projects = await ProjectModel.find(filter)
    .populate(PROJECT_POPULATE)
    .sort({ createdAt: -1 })
    .limit(500);

  return projects.map((p) =>
    serializeProject(p, { actorUserId: input.actorUserId, actorRole: input.actorRole }),
  );
}

export async function getProject(projectId: string, options: ProjectViewOptions) {
  const project = await findProjectById(projectId);

  if (
    (options.actorRole === "TL" || options.actorRole === "CAPTAIN") &&
    !isProjectAdminRole(options.actorRole) &&
    project.tlUserId?.toString() !== options.actorUserId
  ) {
    throw new ApiError(403, "Forbidden");
  }

  return serializeProject(project, options);
}

export async function updateProject(
  projectId: string,
  input: {
    name?: string;
    description?: string | null;
    clientName?: string | null;
    status?: ProjectStatus;
    budget?: number | null;
    revenue?: number;
    currency?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    teamId?: string | null;
    tlUserId?: string | null;
    managerUserId?: string | null;
    memberUserIds?: string[] | null;
    updatedByUserId: string;
    actorRole: Role;
  },
) {
  const project = await ProjectModel.findById(projectId);
  if (!project || !project.isActive) throw new ApiError(404, "Project not found");

  const changingTeam =
    input.tlUserId !== undefined || input.memberUserIds !== undefined || input.teamId !== undefined;

  if (changingTeam) {
    assertCanManageMembers(input.actorRole, input.updatedByUserId, project);
  } else if (
    (input.actorRole === "TL" || input.actorRole === "CAPTAIN") &&
    !isProjectAdminRole(input.actorRole) &&
    project.tlUserId?.toString() !== input.updatedByUserId
  ) {
    throw new ApiError(403, "Forbidden");
  }

  if (input.tlUserId !== undefined && input.tlUserId !== null) {
    await validateTlUserId(input.tlUserId);
  }
  if (input.teamId !== undefined || input.managerUserId !== undefined) {
    await validateTeamAndManager({
      teamId: input.teamId === null ? undefined : (input.teamId ?? project.teamId?.toString()),
      managerUserId:
        input.managerUserId === null
          ? undefined
          : (input.managerUserId ?? project.managerUserId?.toString()),
    });
  }
  if (input.memberUserIds !== undefined && input.memberUserIds !== null) {
    await validateMemberUserIds(input.memberUserIds);
  }

  const fromStatus = project.status as ProjectStatus;

  if (input.name !== undefined) project.name = input.name;
  if (input.description !== undefined) project.description = input.description ?? undefined;
  if (input.clientName !== undefined) project.clientName = input.clientName ?? undefined;
  if (input.budget !== undefined) project.budget = input.budget ?? undefined;
  if (input.revenue !== undefined) project.revenue = input.revenue;
  if (input.currency !== undefined) project.currency = input.currency;
  if (input.startDate !== undefined) project.startDate = input.startDate ?? undefined;
  if (input.endDate !== undefined) project.endDate = input.endDate ?? undefined;
  if (input.teamId !== undefined) {
    project.teamId = input.teamId ? new mongoose.Types.ObjectId(input.teamId) : undefined;
  }
  if (input.tlUserId !== undefined) {
    project.tlUserId = input.tlUserId ? new mongoose.Types.ObjectId(input.tlUserId) : undefined;
  }
  if (input.managerUserId !== undefined) {
    project.managerUserId = input.managerUserId
      ? new mongoose.Types.ObjectId(input.managerUserId)
      : undefined;
  }
  if (input.memberUserIds !== undefined) {
    project.memberUserIds = input.memberUserIds ? memberIdsToObjectIds(input.memberUserIds) : [];
  }

  if (input.status !== undefined && input.status !== fromStatus) {
    project.status = input.status;
    await recordStatusChange({
      entityType: "PROJECT",
      entityId: project._id.toString(),
      fromStatus,
      toStatus: input.status,
      changedByUserId: input.updatedByUserId,
    });
  }

  await project.save();
  await project.populate(PROJECT_POPULATE);
  return serializeProject(project, {
    actorUserId: input.updatedByUserId,
    actorRole: input.actorRole,
  });
}

export async function getProjectProgress(projectId: string, actorUserId: string, actorRole: Role) {
  const project = await findProjectById(projectId);
  assertCanViewProgress(actorRole, actorUserId, project);

  return {
    projectId: project._id.toString(),
    code: project.code,
    name: project.name,
    tlUserId: project.tlUserId,
    memberCount: project.memberUserIds?.length ?? 0,
    workProgress: project.workProgress,
  };
}

export async function updateProjectProgress(
  projectId: string,
  input: {
    percent: number;
    note?: string;
    updatedByUserId: string;
    actorRole: Role;
  },
) {
  const project = await ProjectModel.findById(projectId);
  if (!project || !project.isActive) throw new ApiError(404, "Project not found");

  if (
    !canAccessProjectProgress(input.actorRole, input.updatedByUserId, project.tlUserId?.toString())
  ) {
    throw new ApiError(403, "Only the project TL or an admin can update work progress");
  }

  const previousPercent = project.workProgress?.percent ?? 0;
  project.workProgress = {
    percent: input.percent,
    note: input.note,
    updatedAt: new Date(),
    updatedByUserId: new mongoose.Types.ObjectId(input.updatedByUserId),
  };
  await project.save();

  await recordStatusChange({
    entityType: "PROJECT",
    entityId: project._id.toString(),
    fromStatus: String(previousPercent),
    toStatus: String(input.percent),
    changedByUserId: input.updatedByUserId,
    note: input.note,
    metadata: { type: "WORK_PROGRESS" },
  });

  await project.populate(PROJECT_POPULATE);
  return {
    projectId: project._id.toString(),
    workProgress: project.workProgress,
  };
}

export async function deactivateProject(
  projectId: string,
  deactivatedByUserId: string,
  actorRole: Role,
) {
  const project = await ProjectModel.findById(projectId);
  if (!project || !project.isActive) throw new ApiError(404, "Project not found");

  const fromStatus = project.status as ProjectStatus;
  project.isActive = false;
  project.status = "CANCELLED";
  await project.save();

  await recordStatusChange({
    entityType: "PROJECT",
    entityId: project._id.toString(),
    fromStatus,
    toStatus: "CANCELLED",
    changedByUserId: deactivatedByUserId,
    note: "Project deactivated",
  });

  await project.populate(PROJECT_POPULATE);
  return serializeProject(project, {
    actorUserId: deactivatedByUserId,
    actorRole,
  });
}

export type ProjectSummary = {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  onHoldProjects: number;
  plannedProjects: number;
  cancelledProjects: number;
  totalRevenue: number;
  totalBudget: number;
  averageRevenue: number;
  totalMembers: number;
  averageMembersPerProject: number;
  averageProgressPercent: number;
  byStatus: Record<ProjectStatus, number>;
};

export type ProjectOverviewItem = {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
  clientName?: string;
  memberCount: number;
  tlUserId?: string;
  tlUser?: {
    _id: string;
    fullName?: string;
    email?: string;
    role?: string;
  };
  progressPercent?: number;
  progressNote?: string;
  progressUpdatedAt?: Date;
};

export type ProjectOverview = {
  summary: ProjectSummary;
  projects: ProjectOverviewItem[];
};

export async function getProjectSummary(input?: {
  from?: Date;
  to?: Date;
  tlUserId?: string;
}): Promise<ProjectSummary> {
  const match: Record<string, unknown> = { isActive: true };
  if (input?.tlUserId) match.tlUserId = new mongoose.Types.ObjectId(input.tlUserId);
  if (input?.from || input?.to) {
    match.createdAt = {
      ...(input.from ? { $gte: input.from } : {}),
      ...(input.to ? { $lte: input.to } : {}),
    };
  }

  const [agg] = await ProjectModel.aggregate<{
    totalProjects: number;
    totalRevenue: number;
    totalBudget: number;
    totalMembers: number;
    averageProgressPercent: number;
    activeProjects: number;
    completedProjects: number;
    onHoldProjects: number;
    plannedProjects: number;
    cancelledProjects: number;
    byStatus: { status: ProjectStatus; count: number }[];
  }>([
    { $match: match },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalProjects: { $sum: 1 },
              totalRevenue: { $sum: "$revenue" },
              totalBudget: { $sum: { $ifNull: ["$budget", 0] } },
              totalMembers: { $sum: { $size: { $ifNull: ["$memberUserIds", []] } } },
              averageProgressPercent: { $avg: { $ifNull: ["$workProgress.percent", 0] } },
              activeProjects: {
                $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] },
              },
              completedProjects: {
                $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] },
              },
              onHoldProjects: {
                $sum: { $cond: [{ $eq: ["$status", "ON_HOLD"] }, 1, 0] },
              },
              plannedProjects: {
                $sum: { $cond: [{ $eq: ["$status", "PLANNED"] }, 1, 0] },
              },
              cancelledProjects: {
                $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] },
              },
            },
          },
        ],
        byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
      },
    },
    {
      $project: {
        totalProjects: { $ifNull: [{ $arrayElemAt: ["$totals.totalProjects", 0] }, 0] },
        totalRevenue: { $ifNull: [{ $arrayElemAt: ["$totals.totalRevenue", 0] }, 0] },
        totalBudget: { $ifNull: [{ $arrayElemAt: ["$totals.totalBudget", 0] }, 0] },
        totalMembers: { $ifNull: [{ $arrayElemAt: ["$totals.totalMembers", 0] }, 0] },
        averageProgressPercent: {
          $ifNull: [{ $arrayElemAt: ["$totals.averageProgressPercent", 0] }, 0],
        },
        activeProjects: { $ifNull: [{ $arrayElemAt: ["$totals.activeProjects", 0] }, 0] },
        completedProjects: { $ifNull: [{ $arrayElemAt: ["$totals.completedProjects", 0] }, 0] },
        onHoldProjects: { $ifNull: [{ $arrayElemAt: ["$totals.onHoldProjects", 0] }, 0] },
        plannedProjects: { $ifNull: [{ $arrayElemAt: ["$totals.plannedProjects", 0] }, 0] },
        cancelledProjects: { $ifNull: [{ $arrayElemAt: ["$totals.cancelledProjects", 0] }, 0] },
        byStatus: {
          $map: {
            input: "$byStatus",
            as: "row",
            in: { status: "$$row._id", count: "$$row.count" },
          },
        },
      },
    },
  ]);

  const emptyByStatus: Record<ProjectStatus, number> = {
    PLANNED: 0,
    ACTIVE: 0,
    ON_HOLD: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };

  const totalProjects = agg?.totalProjects ?? 0;
  const totalMembers = agg?.totalMembers ?? 0;
  const byStatus = { ...emptyByStatus };
  for (const row of agg?.byStatus ?? []) {
    if (row.status) byStatus[row.status] = row.count;
  }

  return {
    totalProjects,
    activeProjects: agg?.activeProjects ?? 0,
    completedProjects: agg?.completedProjects ?? 0,
    onHoldProjects: agg?.onHoldProjects ?? 0,
    plannedProjects: agg?.plannedProjects ?? 0,
    cancelledProjects: agg?.cancelledProjects ?? 0,
    totalRevenue: agg?.totalRevenue ?? 0,
    totalBudget: agg?.totalBudget ?? 0,
    averageRevenue: totalProjects > 0 ? (agg?.totalRevenue ?? 0) / totalProjects : 0,
    totalMembers,
    averageMembersPerProject: totalProjects > 0 ? totalMembers / totalProjects : 0,
    averageProgressPercent: Math.round((agg?.averageProgressPercent ?? 0) * 100) / 100,
    byStatus,
  };
}

function toOverviewItem(
  project: HydratedDocument<ProjectDoc>,
  options: ProjectViewOptions,
): ProjectOverviewItem {
  const memberCount = project.memberUserIds?.length ?? 0;
  const tlRef = project.tlUserId;
  const tlPopulated =
    tlRef &&
    typeof tlRef === "object" &&
    "fullName" in tlRef &&
    typeof (tlRef as { fullName?: string }).fullName === "string"
      ? (tlRef as {
          _id: mongoose.Types.ObjectId;
          fullName: string;
          email?: string;
          role?: string;
        })
      : null;

  const item: ProjectOverviewItem = {
    id: project._id.toString(),
    code: project.code,
    name: project.name,
    status: project.status as ProjectStatus,
    clientName: project.clientName ?? undefined,
    memberCount,
    tlUserId: tlPopulated ? tlPopulated._id.toString() : tlRef?.toString(),
    ...(tlPopulated
      ? {
          tlUser: {
            _id: tlPopulated._id.toString(),
            fullName: tlPopulated.fullName,
            email: tlPopulated.email,
            role: tlPopulated.role,
          },
        }
      : {}),
  };

  if (
    canViewAllProjectsProgress(options.actorRole) ||
    canAccessProjectProgress(options.actorRole, options.actorUserId, project.tlUserId?.toString())
  ) {
    item.progressPercent = project.workProgress?.percent ?? 0;
    item.progressNote = project.workProgress?.note ?? undefined;
    item.progressUpdatedAt = project.workProgress?.updatedAt ?? undefined;
  }

  return item;
}

export async function getProjectOverview(input: {
  from?: Date;
  to?: Date;
  tlUserId?: string;
  status?: ProjectStatus;
  actorUserId: string;
  actorRole: Role;
}): Promise<ProjectOverview> {
  const filter: Record<string, unknown> = { isActive: true };
  if (input.status) filter.status = input.status;
  if (input.from || input.to) {
    filter.createdAt = {
      ...(input.from ? { $gte: input.from } : {}),
      ...(input.to ? { $lte: input.to } : {}),
    };
  }

  let tlUserId = input.tlUserId;
  if (input.actorRole === "TL" || input.actorRole === "CAPTAIN") {
    if (!isProjectAdminRole(input.actorRole) && !canViewAllProjectsProgress(input.actorRole)) {
      tlUserId = input.actorUserId;
    }
  }
  if (tlUserId) filter.tlUserId = new mongoose.Types.ObjectId(tlUserId);

  const projects = await ProjectModel.find(filter)
    .populate(PROJECT_POPULATE)
    .sort({ "workProgress.percent": -1, createdAt: -1 })
    .limit(500);

  const viewOptions: ProjectViewOptions = {
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
  };

  const summary = await getProjectSummary({
    from: input.from,
    to: input.to,
    tlUserId,
  });

  return {
    summary,
    projects: projects.map((p) => toOverviewItem(p, viewOptions)),
  };
}
