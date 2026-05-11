import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError";
import { UserModel } from "../models/User";

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.auth?.userId;
    if (!userId) throw new ApiError(401, "Unauthorized");

    const user = await UserModel.findById(userId).select(
      "_id email fullName phone role status employeeId traineeId mustChangePassword createdAt updatedAt",
    );
    if (!user) throw new ApiError(404, "User not found");

    res.json({ user });
  } catch (err) {
    next(err);
  }
}
