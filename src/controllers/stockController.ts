import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError";
import {
  addMovement,
  closeMaintenance,
  createStockItem,
  deactivateStockItem,
  getCurrentStockReport,
  listStockItems,
  startMaintenance,
  updateStockItem,
} from "../services/stockService";
import { stockValidation } from "../validation/stock.validation";

async function requireUserId(req: Request) {
  const userId = req.auth?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");
  return userId;
}

export async function createItem(req: Request, res: Response, next: NextFunction) {
  try {
    const createdByUserId = await requireUserId(req);
    const item = await createStockItem({
      name: req.body.name,
      category: req.body.category,
      unit: req.body.unit,
      images: req.body.images,
      createdByUserId,
    });
    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
}

export async function updateItem(req: Request, res: Response, next: NextFunction) {
  try {
    const updatedByUserId = await requireUserId(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const item = await updateStockItem(id, {
      name: req.body.name,
      category: req.body.category,
      unit: req.body.unit,
      isActive: req.body.isActive,
      images: req.body.images,
      updatedByUserId,
    });
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

export async function deleteItem(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const item = await deactivateStockItem(id);
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

export async function listItems(_req: Request, res: Response, next: NextFunction) {
  try {
    const items = await listStockItems();
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function addStock(req: Request, res: Response, next: NextFunction) {
  try {
    const createdByUserId = await requireUserId(req);
    const movement = await addMovement({
      itemId: req.body.itemId,
      type: "IN",
      quantity: req.body.quantity,
      createdByUserId,
      note: req.body.note,
      images: req.body.images,
    });
    res.status(201).json({ movement });
  } catch (err) {
    next(err);
  }
}

export async function issueStock(req: Request, res: Response, next: NextFunction) {
  try {
    const createdByUserId = await requireUserId(req);
    const movement = await addMovement({
      itemId: req.body.itemId,
      type: "OUT",
      quantity: req.body.quantity,
      createdByUserId,
      note: req.body.note,
      issuedToUserId: req.body.issuedToUserId,
      images: req.body.images,
    });
    res.status(201).json({ movement });
  } catch (err) {
    next(err);
  }
}

export async function damageStock(req: Request, res: Response, next: NextFunction) {
  try {
    const createdByUserId = await requireUserId(req);
    const movement = await addMovement({
      itemId: req.body.itemId,
      type: "DAMAGE",
      quantity: req.body.quantity,
      createdByUserId,
      note: req.body.note,
      images: req.body.images,
    });
    res.status(201).json({ movement });
  } catch (err) {
    next(err);
  }
}

export async function replaceStock(req: Request, res: Response, next: NextFunction) {
  try {
    const createdByUserId = await requireUserId(req);
    const movement = await addMovement({
      itemId: req.body.itemId,
      type: "REPLACE",
      quantity: req.body.quantity,
      createdByUserId,
      note: req.body.note,
      images: req.body.images,
    });
    res.status(201).json({ movement });
  } catch (err) {
    next(err);
  }
}

export async function startMaintenanceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const createdByUserId = await requireUserId(req);
    const maintenance = await startMaintenance({
      itemId: req.body.itemId,
      quantity: req.body.quantity,
      createdByUserId,
      note: req.body.note,
      images: req.body.images,
    });
    res.status(201).json({ maintenance });
  } catch (err) {
    next(err);
  }
}

export async function closeMaintenanceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const closedByUserId = await requireUserId(req);
    const maintenance = await closeMaintenance({
      maintenanceId: req.body.maintenanceId,
      closedByUserId,
      note: req.body.note,
      images: req.body.images,
    });
    res.json({ maintenance });
  } catch (err) {
    next(err);
  }
}

export async function currentReport(_req: Request, res: Response, next: NextFunction) {
  try {
    const report = await getCurrentStockReport();
    res.json({ report });
  } catch (err) {
    next(err);
  }
}

// Re-export request validators for routes
export const createItemSchema = stockValidation.createItem;
export const itemIdParamsSchema = stockValidation.itemIdParams;
export const updateItemSchema = stockValidation.updateItem;
export const movementSchema = stockValidation.movement;
export const maintenanceStartSchema = stockValidation.maintenanceStart;
export const maintenanceCloseSchema = stockValidation.maintenanceClose;
