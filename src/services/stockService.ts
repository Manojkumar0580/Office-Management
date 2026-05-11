import { ApiError } from "../utils/apiError";
import mongoose from "mongoose";
import { StockItemModel } from "../models/StockItem";
import { StockMaintenanceModel } from "../models/StockMaintenance";
import { StockMovementModel, type StockMovementType } from "../models/StockMovement";
import { saveBase64Images, type Base64ImageInput, type SavedImage } from "../utils/base64Image";
import { recordStatusChange } from "./statusLogService";

async function getCurrentStockQuantity(itemId: string) {
  const movements = await StockMovementModel.aggregate<{ _id: string; qty: number }>([
    { $match: { itemId: new mongoose.Types.ObjectId(itemId) } },
    {
      $group: {
        _id: "$itemId",
        qty: {
          $sum: {
            $switch: {
              branches: [
                {
                  case: { $in: ["$type", ["IN", "REPLACE", "MAINTENANCE_IN"]] },
                  then: "$quantity",
                },
                {
                  case: { $in: ["$type", ["OUT", "DAMAGE", "MAINTENANCE_OUT"]] },
                  then: { $multiply: ["$quantity", -1] },
                },
              ],
              default: 0,
            },
          },
        },
      },
    },
  ]);

  return movements[0]?.qty ?? 0;
}

export async function createStockItem(input: {
  name: string;
  category?: string;
  unit?: string;
  images?: Base64ImageInput[];
  createdByUserId?: string;
}) {
  const savedImages: SavedImage[] = saveBase64Images(input.images);
  const item = await StockItemModel.create({
    name: input.name,
    category: input.category,
    unit: input.unit ?? "pcs",
    images: savedImages.map((i) => ({
      ...i,
      uploadedByUserId: input.createdByUserId,
    })),
  });
  return item;
}

export async function updateStockItem(
  itemId: string,
  input: {
    name?: string;
    category?: string;
    unit?: string;
    isActive?: boolean;
    images?: Base64ImageInput[];
    updatedByUserId?: string;
  },
) {
  const item = await StockItemModel.findById(itemId);
  if (!item) throw new ApiError(404, "Stock item not found");

  if (input.name !== undefined) item.name = input.name;
  if (input.category !== undefined) item.category = input.category;
  if (input.unit !== undefined) item.unit = input.unit;
  if (input.isActive !== undefined) item.isActive = input.isActive;

  const savedImages = saveBase64Images(input.images);
  if (savedImages.length > 0) {
    item.images = [
      ...(item.images ?? []),
      ...savedImages.map((i) => ({
        ...i,
        uploadedByUserId: input.updatedByUserId,
      })),
    ];
  }

  await item.save();
  return item;
}

export async function deactivateStockItem(itemId: string) {
  const item = await StockItemModel.findByIdAndUpdate(itemId, { isActive: false }, { new: true });
  if (!item) throw new ApiError(404, "Stock item not found");
  return item;
}

export async function listStockItems() {
  return await StockItemModel.find({}).sort({ createdAt: -1 }).limit(500);
}

export async function addMovement(input: {
  itemId: string;
  type: StockMovementType;
  quantity: number;
  createdByUserId: string;
  note?: string;
  issuedToUserId?: string;
  images?: Base64ImageInput[];
}) {
  const item = await StockItemModel.findById(input.itemId);
  if (!item) throw new ApiError(404, "Stock item not found");
  if (!item.isActive) throw new ApiError(409, "Stock item is inactive");

  if (["OUT", "DAMAGE", "MAINTENANCE_OUT"].includes(input.type)) {
    const current = await getCurrentStockQuantity(input.itemId);
    if (current < input.quantity) throw new ApiError(409, "Insufficient stock");
  }

  const savedImages = saveBase64Images(input.images);

  const movement = await StockMovementModel.create({
    itemId: input.itemId,
    type: input.type,
    quantity: input.quantity,
    note: input.note,
    issuedToUserId: input.issuedToUserId,
    createdByUserId: input.createdByUserId,
    occurredAt: new Date(),
    images: savedImages,
  });

  // Log the movement creation as a status entry for traceability.
  await recordStatusChange({
    entityType: "STOCK_MOVEMENT",
    entityId: movement._id.toString(),
    toStatus: input.type,
    changedByUserId: input.createdByUserId,
    note: input.note,
    metadata: {
      itemId: input.itemId,
      quantity: input.quantity,
      issuedToUserId: input.issuedToUserId,
      imageCount: savedImages.length,
    },
  });

  return movement;
}

export async function startMaintenance(input: {
  itemId: string;
  quantity: number;
  createdByUserId: string;
  note?: string;
  images?: Base64ImageInput[];
}) {
  // move stock out to maintenance
  await addMovement({
    itemId: input.itemId,
    type: "MAINTENANCE_OUT",
    quantity: input.quantity,
    createdByUserId: input.createdByUserId,
    note: input.note,
  });

  const savedImages = saveBase64Images(input.images);

  const maintenance = await StockMaintenanceModel.create({
    itemId: input.itemId,
    quantity: input.quantity,
    status: "OPEN",
    note: input.note,
    createdByUserId: input.createdByUserId,
    startedAt: new Date(),
    images: savedImages.map((i) => ({ ...i, stage: "BEFORE" })),
  });

  await recordStatusChange({
    entityType: "STOCK_MAINTENANCE",
    entityId: maintenance._id.toString(),
    toStatus: "OPEN",
    changedByUserId: input.createdByUserId,
    note: input.note,
    metadata: {
      itemId: input.itemId,
      quantity: input.quantity,
      imageCount: savedImages.length,
    },
  });

  return maintenance;
}

export async function closeMaintenance(input: {
  maintenanceId: string;
  closedByUserId: string;
  note?: string;
  images?: Base64ImageInput[];
}) {
  const maint = await StockMaintenanceModel.findById(input.maintenanceId);
  if (!maint) throw new ApiError(404, "Maintenance record not found");
  if (maint.status !== "OPEN") throw new ApiError(409, "Maintenance already closed");

  // move stock back from maintenance
  await addMovement({
    itemId: maint.itemId.toString(),
    type: "MAINTENANCE_IN",
    quantity: maint.quantity,
    createdByUserId: input.closedByUserId,
    note: input.note,
  });

  const fromStatus = maint.status as string;
  const savedImages = saveBase64Images(input.images);
  if (savedImages.length > 0) {
    maint.images = [
      ...(maint.images ?? []),
      ...savedImages.map((i) => ({ ...i, stage: "AFTER" as const })),
    ];
  }

  maint.status = "CLOSED";
  maint.closedByUserId = input.closedByUserId;
  maint.closedAt = new Date();
  if (input.note) maint.note = input.note;
  await maint.save();

  await recordStatusChange({
    entityType: "STOCK_MAINTENANCE",
    entityId: maint._id.toString(),
    fromStatus,
    toStatus: "CLOSED",
    changedByUserId: input.closedByUserId,
    note: input.note,
    metadata: { imageCount: savedImages.length },
  });

  return maint;
}

export async function getCurrentStockReport() {
  // Aggregate quantities for all items.
  const agg = await StockMovementModel.aggregate<{ itemId: mongoose.Types.ObjectId; qty: number }>([
    {
      $group: {
        _id: "$itemId",
        qty: {
          $sum: {
            $switch: {
              branches: [
                {
                  case: { $in: ["$type", ["IN", "REPLACE", "MAINTENANCE_IN"]] },
                  then: "$quantity",
                },
                {
                  case: { $in: ["$type", ["OUT", "DAMAGE", "MAINTENANCE_OUT"]] },
                  then: { $multiply: ["$quantity", -1] },
                },
              ],
              default: 0,
            },
          },
        },
      },
    },
    { $project: { _id: 0, itemId: "$_id", qty: 1 } },
  ]);

  const itemIds = agg.map((a) => a.itemId);
  const items = await StockItemModel.find({ _id: { $in: itemIds } }).select(
    "_id name category unit isActive images",
  );
  const byId = new Map(items.map((i) => [i._id.toString(), i]));

  return agg.map((row) => ({
    item: byId.get(row.itemId.toString()),
    quantity: row.qty,
  }));
}
