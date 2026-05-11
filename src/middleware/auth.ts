import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/apiError";
import type { Role } from "../types/express";

type JwtPayload = {
  sub: string;
  role: Role;
};

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header("authorization");
    if (!header) throw new ApiError(401, "Missing Authorization header");

    const [scheme, token] = header.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      throw new ApiError(401, "Invalid Authorization header");
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new ApiError(500, "JWT_SECRET not configured");

    const decoded = jwt.verify(token, secret) as JwtPayload;
    if (!decoded?.sub || !decoded?.role) throw new ApiError(401, "Invalid token");

    req.auth = { userId: decoded.sub, role: decoded.role };
    next();
  } catch (err) {
    next(err);
  }
}
