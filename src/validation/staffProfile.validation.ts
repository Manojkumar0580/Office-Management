import Joi from "joi";
import { validate } from "../middleware/validate";
import { base64ImageSchema } from "./common.validation";

export const staffProfileValidation = {
  staffIdParams: validate({
    params: Joi.object({
      id: Joi.string().required(),
    }),
  }),

  profileUpdate: validate({
    body: Joi.object({
      additionalDetails: Joi.object({
        address: Joi.string().optional(),
        emergencyContactName: Joi.string().optional(),
        emergencyContactPhone: Joi.string().optional(),
      }).optional(),
      professional: Joi.object({
        qualification: Joi.string().optional(),
        experienceSummary: Joi.string().optional(),
      }).optional(),
      aadharNumberLast4: Joi.string()
        .length(4)
        .pattern(/^[0-9]{4}$/)
        .optional(),
    }),
  }),

  reviewRequest: validate({
    body: Joi.object({
      approved: Joi.boolean().required(),
      reason: Joi.string().max(500).optional(),
    }),
  }),

  certificate: validate({
    body: Joi.object({
      name: Joi.string().min(2).required(),
    }),
  }),

  livePhotoBase64: validate({
    body: Joi.object({
      image: base64ImageSchema.required(),
    }),
  }),

  cvBase64: validate({
    body: Joi.object({
      image: base64ImageSchema.required(),
    }),
  }),

  certificateBase64: validate({
    body: Joi.object({
      name: Joi.string().min(2).required(),
      image: base64ImageSchema.required(),
    }),
  }),
} as const;
