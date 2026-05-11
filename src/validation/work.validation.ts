import Joi from "joi";
import { validate } from "../middleware/validate";
import { base64ImagesArraySchema } from "./common.validation";

export const workValidation = {
  assign: validate({
    body: Joi.object({
      title: Joi.string().min(2).required(),
      description: Joi.string().optional(),
      assignedToUserId: Joi.string().required(),
      dueDate: Joi.date().optional(),
      images: base64ImagesArraySchema,
    }),
  }),

  list: validate({
    query: Joi.object({
      assignedToUserId: Joi.string().optional(),
      status: Joi.string().valid("ASSIGNED", "SUBMITTED", "APPROVED", "REJECTED").optional(),
      from: Joi.date().optional(),
      to: Joi.date().optional(),
    }),
  }),

  workIdParams: validate({
    params: Joi.object({
      id: Joi.string().required(),
    }),
  }),

  submit: validate({
    body: Joi.object({
      note: Joi.string().optional(),
      images: base64ImagesArraySchema,
    }),
  }),

  review: validate({
    body: Joi.object({
      approved: Joi.boolean().required(),
      note: Joi.string().optional(),
    }),
  }),

  dailyReport: validate({
    query: Joi.object({
      from: Joi.date().required(),
      to: Joi.date().required(),
    }),
  }),
} as const;
