import Joi from "joi";
import { validate } from "../middleware/validate";
import { base64ImagesArraySchema } from "./common.validation";

export const stockValidation = {
  createItem: validate({
    body: Joi.object({
      name: Joi.string().min(2).required(),
      category: Joi.string().optional(),
      unit: Joi.string().optional(),
      images: base64ImagesArraySchema,
    }),
  }),

  itemIdParams: validate({
    params: Joi.object({
      id: Joi.string().required(),
    }),
  }),

  updateItem: validate({
    body: Joi.object({
      name: Joi.string().min(2).optional(),
      category: Joi.string().optional(),
      unit: Joi.string().optional(),
      isActive: Joi.boolean().optional(),
      images: base64ImagesArraySchema,
    }),
  }),

  movement: validate({
    body: Joi.object({
      itemId: Joi.string().required(),
      quantity: Joi.number().integer().min(1).required(),
      note: Joi.string().optional(),
      issuedToUserId: Joi.string().optional(),
      images: base64ImagesArraySchema,
    }),
  }),

  maintenanceStart: validate({
    body: Joi.object({
      itemId: Joi.string().required(),
      quantity: Joi.number().integer().min(1).required(),
      note: Joi.string().optional(),
      images: base64ImagesArraySchema,
    }),
  }),

  maintenanceClose: validate({
    body: Joi.object({
      maintenanceId: Joi.string().required(),
      note: Joi.string().optional(),
      images: base64ImagesArraySchema,
    }),
  }),
} as const;
