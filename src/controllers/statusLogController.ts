import type { NextFunction, Request, Response } from "express";
import type { StatusEntityType } from "../models/StatusLog";
import { listStatusLogs } from "../services/statusLogService";
import { statusLogValidation } from "../validation/statusLog.validation";

export async function listLogsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const logs = await listStatusLogs({
      entityType: req.query.entityType as StatusEntityType | undefined,
      entityId: req.query.entityId as string | undefined,
      changedByUserId: req.query.changedByUserId as string | undefined,
      from: req.query.from ? new Date(String(req.query.from)) : undefined,
      to: req.query.to ? new Date(String(req.query.to)) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ logs });
  } catch (err) {
    next(err);
  }
}

export const statusLogListSchema = statusLogValidation.list;
