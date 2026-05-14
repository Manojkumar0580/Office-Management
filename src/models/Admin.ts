import mongoose, { type InferSchemaType } from "mongoose";
import type { Role } from "../types/express";

/** Roles that get a row in the `Admin` collection (platform administrators). */
export const ADMIN_RECORD_ROLES: readonly Role[] = ["SUPER_ADMIN", "ADMIN"];

/**
 * Separate record for platform admins (`SUPER_ADMIN` / `ADMIN`).
 * Authentication and primary identity stay on `User`; this holds admin-specific metadata.
 */
const adminSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    /** Optional display title (e.g. "Technical Administrator"). */
    jobTitle: { type: String, required: false, trim: true, maxlength: 150 },
    /** Internal notes (not shown to the user). */
    notes: { type: String, required: false, maxlength: 2000 },
  },
  { timestamps: true },
);

export type AdminDoc = InferSchemaType<typeof adminSchema> & { _id: mongoose.Types.ObjectId };

export const AdminModel = mongoose.models.Admin ?? mongoose.model("Admin", adminSchema);
