import mongoose, { type InferSchemaType } from "mongoose";

export type WorkStatus = "ASSIGNED" | "SUBMITTED" | "APPROVED" | "REJECTED";

const workItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, required: false },
    status: {
      type: String,
      required: true,
      enum: ["ASSIGNED", "SUBMITTED", "APPROVED", "REJECTED"] satisfies WorkStatus[],
      default: "ASSIGNED",
      index: true,
    },
    assignedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assignedToUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    dueDate: { type: Date, required: false, index: true },

    attachments: [
      {
        originalName: { type: String, required: true },
        filePath: { type: String, required: true },
        uploadedAt: { type: Date, required: true, default: () => new Date() },
      },
    ],

    reviewedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    reviewedAt: { type: Date, required: false },
    reviewNote: { type: String, required: false },
  },
  { timestamps: true },
);

export type WorkItemDoc = InferSchemaType<typeof workItemSchema> & { _id: mongoose.Types.ObjectId };

export const WorkItemModel = mongoose.models.WorkItem ?? mongoose.model("WorkItem", workItemSchema);
