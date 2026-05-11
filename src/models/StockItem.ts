import mongoose, { type InferSchemaType } from "mongoose";

const stockItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    category: { type: String, required: false, trim: true, index: true },
    unit: { type: String, required: true, trim: true, default: "pcs" },
    isActive: { type: Boolean, required: true, default: true, index: true },

    images: [
      {
        originalName: { type: String, required: true },
        filePath: { type: String, required: true },
        mimeType: { type: String, required: false },
        sizeBytes: { type: Number, required: false },
        uploadedByUserId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: false,
        },
        uploadedAt: { type: Date, required: true, default: () => new Date() },
      },
    ],
  },
  { timestamps: true },
);

export type StockItemDoc = InferSchemaType<typeof stockItemSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const StockItemModel =
  mongoose.models.StockItem ?? mongoose.model("StockItem", stockItemSchema);
