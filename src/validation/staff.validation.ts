import Joi from "joi";
import { validate } from "../middleware/validate";

export const staffValidation = {
  staffIdParams: validate({
    params: Joi.object({
      id: Joi.string().required(),
    }),
  }),

  reviewBody: validate({
    body: Joi.object({
      status: Joi.string().valid("APPROVED", "REJECTED").required(),
      reason: Joi.string().max(500).optional(),
    }),
  }),
} as const;
