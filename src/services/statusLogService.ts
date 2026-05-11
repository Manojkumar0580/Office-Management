import { StatusLogModel, type StatusEntityType } from "../models/StatusLog";

export async function recordStatusChange(input: {
  entityType: StatusEntityType;
  entityId: string;
  fromStatus?: string;
  toStatus: string;
  changedByUserId: string;
  note?: string;
  metadata?: Record<string, unknown>;
}) {
  return await StatusLogModel.create({
    entityType: input.entityType,
    entityId: input.entityId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    changedByUserId: input.changedByUserId,
    note: input.note,
    metadata: input.metadata,
    changedAt: new Date(),
  });
}

export async function listStatusLogs(input: {
  entityType?: StatusEntityType;
  entityId?: string;
  changedByUserId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  const filter: Record<string, unknown> = {};
  if (input.entityType) filter.entityType = input.entityType;
  if (input.entityId) filter.entityId = input.entityId;
  if (input.changedByUserId) filter.changedByUserId = input.changedByUserId;
  if (input.from || input.to) {
    filter.changedAt = {
      ...(input.from ? { $gte: input.from } : {}),
      ...(input.to ? { $lte: input.to } : {}),
    };
  }

  return await StatusLogModel.find(filter)
    .sort({ changedAt: -1 })
    .limit(Math.min(input.limit ?? 200, 1000))
    .populate("changedByUserId", "_id fullName email role");
}
