import Joi from "joi";
import { validate } from "../middleware/validate";
import { base64ImageSchema } from "./common.validation";

const certificateBase64Schema = Joi.object({
  name: Joi.string().min(2).max(150).required(),
  image: base64ImageSchema.required(),
});

const registrationBody = Joi.object({
  // Account
  email: Joi.string().email().required(),
  fullName: Joi.string().min(2).max(150).required(),
  phone: Joi.string()
    .pattern(/^[0-9+\-\s()]{6,20}$/)
    .optional(),
  password: Joi.string().min(8).max(128).required(),

  // Identity verification
  aadharNumberLast4: Joi.string()
    .length(4)
    .pattern(/^[0-9]{4}$/)
    .optional(),

  // Address & emergency contact
  additionalDetails: Joi.object({
    address: Joi.string().max(500).optional(),
    emergencyContactName: Joi.string().max(150).optional(),
    emergencyContactPhone: Joi.string()
      .pattern(/^[0-9+\-\s()]{6,20}$/)
      .optional(),
  }).optional(),

  // Professional info
  professional: Joi.object({
    qualification: Joi.string().max(300).optional(),
    experienceSummary: Joi.string().max(2000).optional(),
  }).optional(),

  // Live selfie photo (verification)
  livePhoto: base64ImageSchema.optional(),

  // Certificates / documents
  certificates: Joi.array().items(certificateBase64Schema).max(10).optional(),
});

export const authValidation = {
  registerStaff: validate({ body: registrationBody }),
  registerTrainee: validate({ body: registrationBody }),

  login: validate({
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    }),
  }),

  changePassword: validate({
    body: Joi.object({
      oldPassword: Joi.string().optional(),
      newPassword: Joi.string().min(8).required(),
    }),
  }),

  bootstrapSuperAdmin: validate({
    body: Joi.object({
      email: Joi.string().email().required(),
      fullName: Joi.string().min(2).required(),
      password: Joi.string().min(10).required(),
      bootstrapKey: Joi.string().required(),
    }),
  }),
} as const;
