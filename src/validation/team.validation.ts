import Joi from "joi";
import { validate } from "../middleware/validate";

export const teamValidation = {
  createTeam: validate({
    body: Joi.object({
      name: Joi.string().min(2).max(100).required(),
      description: Joi.string().max(500).optional(),
      managerUserId: Joi.string().optional(),
      leadUserId: Joi.string().optional(),
    }),
  }),

  updateTeam: validate({
    body: Joi.object({
      name: Joi.string().min(2).max(100).optional(),
      description: Joi.string().max(500).optional(),
      managerUserId: Joi.alternatives().try(Joi.string(), Joi.valid(null)).optional(),
      leadUserId: Joi.alternatives().try(Joi.string(), Joi.valid(null)).optional(),
      isActive: Joi.boolean().optional(),
    }),
  }),

  teamIdParams: validate({
    params: Joi.object({
      id: Joi.string().required(),
    }),
  }),

  assignUser: validate({
    body: Joi.object({
      userId: Joi.string().required(),
      teamId: Joi.alternatives().try(Joi.string(), Joi.valid(null)).required(),
      reportsToUserId: Joi.alternatives().try(Joi.string(), Joi.valid(null)).optional(),
    }),
  }),
} as const;
