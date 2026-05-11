import { ApiError } from "../utils/apiError";
import { WorkItemModel, type WorkStatus } from "../models/WorkItem";
import { WorkSubmissionModel } from "../models/WorkSubmission";
import { saveBase64Images, type Base64ImageInput } from "../utils/base64Image";
import { recordStatusChange } from "./statusLogService";

export async function assignWork(input: {
  title: string;
  description?: string;
  assignedByUserId: string;
  assignedToUserId: string;
  dueDate?: Date;
  images?: Base64ImageInput[];
}) {
  const savedImages = saveBase64Images(input.images);
  const work = await WorkItemModel.create({
    title: input.title,
    description: input.description,
    assignedByUserId: input.assignedByUserId,
    assignedToUserId: input.assignedToUserId,
    dueDate: input.dueDate,
    status: "ASSIGNED" satisfies WorkStatus,
    attachments: savedImages.map((i) => ({
      originalName: i.originalName,
      filePath: i.filePath,
      uploadedAt: i.uploadedAt,
    })),
  });

  await recordStatusChange({
    entityType: "WORK_ITEM",
    entityId: work._id.toString(),
    toStatus: "ASSIGNED",
    changedByUserId: input.assignedByUserId,
    metadata: { assignedToUserId: input.assignedToUserId },
  });

  return work;
}

export async function listWork(input: {
  assignedToUserId?: string;
  status?: WorkStatus;
  from?: Date;
  to?: Date;
}) {
  const filter: Record<string, unknown> = {};
  if (input.assignedToUserId) filter.assignedToUserId = input.assignedToUserId;
  if (input.status) filter.status = input.status;
  if (input.from || input.to) {
    filter.createdAt = {
      ...(input.from ? { $gte: input.from } : {}),
      ...(input.to ? { $lte: input.to } : {}),
    };
  }
  return await WorkItemModel.find(filter).sort({ createdAt: -1 }).limit(200);
}

export async function getWork(workItemId: string) {
  const work = await WorkItemModel.findById(workItemId);
  if (!work) throw new ApiError(404, "Work item not found");
  return work;
}

export async function addWorkAttachment(input: {
  workItemId: string;
  originalName: string;
  filePath: string;
}) {
  const work = await getWork(input.workItemId);
  work.attachments = [
    ...(work.attachments ?? []),
    { originalName: input.originalName, filePath: input.filePath, uploadedAt: new Date() },
  ];
  await work.save();
  return work;
}

export async function submitWork(input: {
  workItemId: string;
  submittedByUserId: string;
  note?: string;
  attachments?: { originalName: string; filePath: string }[];
  images?: Base64ImageInput[];
}) {
  const work = await getWork(input.workItemId);
  if (work.assignedToUserId.toString() !== input.submittedByUserId) {
    throw new ApiError(403, "Only the assignee can submit work");
  }
  if (work.status === "APPROVED") throw new ApiError(409, "Work is already approved");

  const fromStatus = work.status as WorkStatus;
  const savedImages = saveBase64Images(input.images);

  const submission = await WorkSubmissionModel.create({
    workItemId: work._id,
    submittedByUserId: input.submittedByUserId,
    note: input.note,
    attachments: [
      ...(input.attachments?.map((a) => ({
        originalName: a.originalName,
        filePath: a.filePath,
        uploadedAt: new Date(),
      })) ?? []),
      ...savedImages.map((i) => ({
        originalName: i.originalName,
        filePath: i.filePath,
        uploadedAt: i.uploadedAt,
      })),
    ],
    submittedAt: new Date(),
  });

  work.status = "SUBMITTED";
  await work.save();

  await recordStatusChange({
    entityType: "WORK_ITEM",
    entityId: work._id.toString(),
    fromStatus,
    toStatus: "SUBMITTED",
    changedByUserId: input.submittedByUserId,
    note: input.note,
    metadata: { submissionId: submission._id.toString(), imageCount: savedImages.length },
  });

  return { work, submission };
}

export async function reviewWork(input: {
  workItemId: string;
  reviewedByUserId: string;
  approved: boolean;
  note?: string;
}) {
  const work = await getWork(input.workItemId);
  if (work.status !== "SUBMITTED") throw new ApiError(409, "Work is not submitted yet");

  const fromStatus = work.status as WorkStatus;
  const toStatus: WorkStatus = input.approved ? "APPROVED" : "REJECTED";

  work.status = toStatus;
  work.reviewedByUserId = input.reviewedByUserId;
  work.reviewedAt = new Date();
  work.reviewNote = input.note;
  await work.save();

  await recordStatusChange({
    entityType: "WORK_ITEM",
    entityId: work._id.toString(),
    fromStatus,
    toStatus,
    changedByUserId: input.reviewedByUserId,
    note: input.note,
  });

  return work;
}

export async function dailyReport(input: { from: Date; to: Date }) {
  const items = await WorkItemModel.find({
    createdAt: { $gte: input.from, $lte: input.to },
  }).select("_id status createdAt");

  const counts: Record<WorkStatus, number> = {
    ASSIGNED: 0,
    SUBMITTED: 0,
    APPROVED: 0,
    REJECTED: 0,
  };

  for (const it of items) {
    const status = it.status as WorkStatus;
    counts[status] += 1;
  }
  return counts;
}
