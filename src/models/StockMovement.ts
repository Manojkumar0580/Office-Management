import mongoose, { type InferSchemaType } from "mongoose";

export type StockMovementType =
  | "IN"
  | "OUT"
  | "DAMAGE"
  | "REPLACE"
  | "MAINTENANCE_OUT"
  | "MAINTENANCE_IN";

const stockMovementSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "StockItem", required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: [
        "IN",
        "OUT",
        "DAMAGE",
        "REPLACE",
        "MAINTENANCE_OUT",
        "MAINTENANCE_IN",
      ] satisfies StockMovementType[],
      index: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    note: { type: String, required: false },

    // For OUT movements
    issuedToUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },

    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    occurredAt: { type: Date, required: true, default: () => new Date(), index: true },

    // Verification photos for the movement (e.g. damaged item, replacement proof, issued goods).
    images: [
      {
        originalName: { type: String, required: true },
        filePath: { type: String, required: true },
        mimeType: { type: String, required: false },
        sizeBytes: { type: Number, required: false },
        uploadedAt: { type: Date, required: true, default: () => new Date() },
      },
    ],
  },
  { timestamps: true },
);

export type StockMovementDoc = InferSchemaType<typeof stockMovementSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const StockMovementModel =
  mongoose.models.StockMovement ?? mongoose.model("StockMovement", stockMovementSchema);
