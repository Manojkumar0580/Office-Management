import mongoose, { type InferSchemaType } from "mongoose";

export type StatusEntityType =
  | "USER"
  | "WORK_ITEM"
  | "STOCK_MAINTENANCE"
  | "PROFILE_CHANGE_REQUEST"
  | "STOCK_MOVEMENT";

const statusLogSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      required: true,
      enum: [
        "USER",
        "WORK_ITEM",
        "STOCK_MAINTENANCE",
        "PROFILE_CHANGE_REQUEST",
        "STOCK_MOVEMENT",
      ] satisfies StatusEntityType[],
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    fromStatus: { type: String, required: false },
    toStatus: { type: String, required: true },
    note: { type: String, required: false },
    changedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    changedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
      index: true,
    },
    metadata: { type: mongoose.Schema.Types.Mixed, required: false },
  },
  { timestamps: true },
);

statusLogSchema.index({ entityType: 1, entityId: 1, changedAt: -1 });

export type StatusLogDoc = InferSchemaType<typeof statusLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const StatusLogModel =
  mongoose.models.StatusLog ?? mongoose.model("StatusLog", statusLogSchema);
