import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({
    status: false,
    statusCode: 404,
    message: "The requested resource was not found.",
  });
}

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      status: false,
      statusCode: err.statusCode,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    status: false,
    statusCode: 500,
    message: "An unexpected error occurred. Please try again later.",
  });
  next();
}
