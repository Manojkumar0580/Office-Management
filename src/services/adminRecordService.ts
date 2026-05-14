import mongoose from "mongoose";
import type { Role } from "../types/express";
import { AdminModel, ADMIN_RECORD_ROLES } from "../models/Admin";

export function isAdminRecordRole(role: Role): boolean {
  return (ADMIN_RECORD_ROLES as readonly string[]).includes(role);
}

/**
 * Ensures an `Admin` document exists for this user when role is SUPER_ADMIN or ADMIN;
 * removes it when the user is no longer in those roles.
 */
export async function syncAdminRecordForUser(userId: string, role: Role) {
  const oid = new mongoose.Types.ObjectId(userId);
  if (isAdminRecordRole(role)) {
    await AdminModel.updateOne(
      { userId: oid },
      { $setOnInsert: { userId: oid } },
      { upsert: true },
    );
  } else {
    await AdminModel.deleteOne({ userId: oid });
  }
}
