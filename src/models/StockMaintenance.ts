import mongoose, { type InferSchemaType } from "mongoose";

export type MaintenanceStatus = "OPEN" | "CLOSED";

const stockMaintenanceSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "StockItem", required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      required: true,
      enum: ["OPEN", "CLOSED"] satisfies MaintenanceStatus[],
      default: "OPEN",
      index: true,
    },
    startedAt: { type: Date, required: true, default: () => new Date() },
    closedAt: { type: Date, required: false },
    note: { type: String, required: false },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    closedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },

    // Verification photos (e.g. before / after maintenance).
    images: [
      {
        originalName: { type: String, required: true },
        filePath: { type: String, required: true },
        mimeType: { type: String, required: false },
        sizeBytes: { type: Number, required: false },
        stage: { type: String, enum: ["BEFORE", "AFTER"], required: false },
        uploadedAt: { type: Date, required: true, default: () => new Date() },
      },
    ],
  },
  { timestamps: true },
);

export type StockMaintenanceDoc = InferSchemaType<typeof stockMaintenanceSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const StockMaintenanceModel =
  mongoose.models.StockMaintenance ?? mongoose.model("StockMaintenance", stockMaintenanceSchema);
