import type { Response } from "express";

/**
 * Standard success body: `status` and HTTP `statusCode` are duplicated in JSON on purpose
 * so clients can read outcome from the body alone.
 */
export function sendSuccess(res: Response, statusCode: number, message: string, data?: unknown) {
  const body: Record<string, unknown> = {
    status: true,
    statusCode,
    message,
  };
  if (data !== undefined) {
    body.data = data;
  }
  return res.status(statusCode).json(body);
}
