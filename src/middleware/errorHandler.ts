import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { message: "Not Found" } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { message: "Internal Server Error" } });
  next();
}
