import Joi from "joi";
import { validate } from "../middleware/validate";

export const statusLogValidation = {
  list: validate({
    query: Joi.object({
      entityType: Joi.string()
        .valid(
          "USER",
          "WORK_ITEM",
          "STOCK_MAINTENANCE",
          "PROFILE_CHANGE_REQUEST",
          "STOCK_MOVEMENT",
          "PROJECT",
        )
        .optional(),
      entityId: Joi.string().optional(),
      changedByUserId: Joi.string().optional(),
      from: Joi.date().optional(),
      to: Joi.date().optional(),
      limit: Joi.number().integer().min(1).max(1000).optional(),
    }),
  }),
} as const;
