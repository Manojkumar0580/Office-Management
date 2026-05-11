import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError";
import type { Role } from "../types/express";

export function requireRoles(allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const role = req.auth?.role;
      if (!role) throw new ApiError(401, "Unauthorized");
      if (!allowed.includes(role)) throw new ApiError(403, "Forbidden");
      next();
    } catch (err) {
      next(err);
    }
  };
}
