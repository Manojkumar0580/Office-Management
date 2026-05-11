import mongoose, { type InferSchemaType } from "mongoose";

export type ProfileChangeStatus = "PENDING" | "APPROVED" | "REJECTED";

const profileChangeRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requestedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["PENDING", "APPROVED", "REJECTED"] satisfies ProfileChangeStatus[],
      default: "PENDING",
      index: true,
    },
    changes: { type: mongoose.Schema.Types.Mixed, required: true },
    reason: { type: String, required: false },
    reviewedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    reviewedAt: { type: Date, required: false },
  },
  { timestamps: true },
);

export type ProfileChangeRequestDoc = InferSchemaType<typeof profileChangeRequestSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ProfileChangeRequestModel =
  mongoose.models.ProfileChangeRequest ??
  mongoose.model("ProfileChangeRequest", profileChangeRequestSchema);
