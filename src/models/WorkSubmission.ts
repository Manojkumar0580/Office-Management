import mongoose, { type InferSchemaType } from "mongoose";

const workSubmissionSchema = new mongoose.Schema(
  {
    workItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkItem",
      required: true,
      index: true,
    },
    submittedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    note: { type: String, required: false },
    attachments: [
      {
        originalName: { type: String, required: true },
        filePath: { type: String, required: true },
        uploadedAt: { type: Date, required: true, default: () => new Date() },
      },
    ],
    submittedAt: { type: Date, required: true, default: () => new Date(), index: true },
  },
  { timestamps: true },
);

export type WorkSubmissionDoc = InferSchemaType<typeof workSubmissionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WorkSubmissionModel =
  mongoose.models.WorkSubmission ?? mongoose.model("WorkSubmission", workSubmissionSchema);
