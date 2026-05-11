import mongoose, { type InferSchemaType } from "mongoose";
import type { Role } from "../types/express";

export type UserStatus = "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "DISABLED";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: false, trim: true },
    fullName: { type: String, required: true, trim: true },

    role: {
      type: String,
      required: true,
      enum: [
        "SUPER_ADMIN",
        "ADMIN",
        "HR",
        "MANAGER",
        "TL",
        "STAFF",
        "TRAINEE",
        "CASHIER",
        "CAPTAIN",
        "ACCOUNTANT",
      ] satisfies Role[],
      default: "STAFF",
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["PENDING_APPROVAL", "ACTIVE", "REJECTED", "DISABLED"] satisfies UserStatus[],
      default: "PENDING_APPROVAL",
      index: true,
    },

    passwordHash: { type: String, required: true },
    mustChangePassword: { type: Boolean, required: true, default: true },

    // Human-readable IDs by role.
    employeeId: { type: String, required: false, unique: true, sparse: true, index: true },
    traineeId: { type: String, required: false, unique: true, sparse: true, index: true },
    humanId: { type: String, required: false, unique: true, sparse: true, index: true },

    // Org structure: which team the user belongs to and who they report to.
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: false, index: true },
    reportsToUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },

    rejectedReason: { type: String, required: false },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

export const UserModel = mongoose.models.User ?? mongoose.model("User", userSchema);
