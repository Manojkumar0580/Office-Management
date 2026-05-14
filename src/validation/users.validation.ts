import Joi from "joi";
import { validate } from "../middleware/validate";
import { base64ImageSchema } from "./common.validation";
import { ADMIN_CREATE_USER_ROLES, ALL_ROLES } from "../utils/roleHierarchy";

const certificateBase64Schema = Joi.object({
  name: Joi.string().min(2).max(150).required(),
  image: base64ImageSchema.required(),
});

export const userValidation = {
  createUser: validate({
    body: Joi.object({
      email: Joi.string().email().required(),
      fullName: Joi.string().min(2).max(150).required(),
      phone: Joi.string()
        .pattern(/^[0-9+\-\s()]{6,20}$/)
        .optional(),
      password: Joi.string().min(8).max(128).required(),
      role: Joi.string()
        .valid(...ADMIN_CREATE_USER_ROLES)
        .required(),

      teamId: Joi.string().optional(),
      reportsToUserId: Joi.string().optional(),

      aadharNumberLast4: Joi.string()
        .length(4)
        .pattern(/^[0-9]{4}$/)
        .optional(),

      additionalDetails: Joi.object({
        address: Joi.string().max(500).optional(),
        emergencyContactName: Joi.string().max(150).optional(),
        emergencyContactPhone: Joi.string()
          .pattern(/^[0-9+\-\s()]{6,20}$/)
          .optional(),
      }).optional(),

      professional: Joi.object({
        qualification: Joi.string().max(300).optional(),
        experienceSummary: Joi.string().max(2000).optional(),
      }).optional(),

      livePhoto: base64ImageSchema.optional(),
      certificates: Joi.array().items(certificateBase64Schema).max(10).optional(),
    }),
  }),

  listUsers: validate({
    query: Joi.object({
      role: Joi.string().optional(),
      status: Joi.string().valid("PENDING_APPROVAL", "ACTIVE", "REJECTED", "DISABLED").optional(),
      teamId: Joi.string().optional(),
    }),
  }),

  promoteUser: validate({
    params: Joi.object({
      id: Joi.string().required(),
    }),
    body: Joi.object({
      role: Joi.string()
        .valid(...ALL_ROLES)
        .required(),
    }),
  }),
} as const;
