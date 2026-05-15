import Joi from "joi";
import { validate } from "../middleware/validate";

const projectStatusSchema = Joi.string().valid(
  "PLANNED",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
);

const memberUserIdsSchema = Joi.array().items(Joi.string()).max(100).optional();

export const projectValidation = {
  createProject: validate({
    body: Joi.object({
      name: Joi.string().min(2).max(200).required(),
      description: Joi.string().max(5000).optional(),
      clientName: Joi.string().max(200).optional(),
      status: projectStatusSchema.optional(),
      budget: Joi.number().min(0).optional(),
      revenue: Joi.number().min(0).optional(),
      currency: Joi.string().length(3).uppercase().optional(),
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().min(Joi.ref("startDate")).optional(),
      teamId: Joi.string().optional(),
      tlUserId: Joi.string().optional(),
      managerUserId: Joi.string().optional(),
      memberUserIds: memberUserIdsSchema,
    }),
  }),

  updateProject: validate({
    body: Joi.object({
      name: Joi.string().min(2).max(200).optional(),
      description: Joi.string().max(5000).allow(null).optional(),
      clientName: Joi.string().max(200).allow(null).optional(),
      status: projectStatusSchema.optional(),
      budget: Joi.number().min(0).allow(null).optional(),
      revenue: Joi.number().min(0).optional(),
      currency: Joi.string().length(3).uppercase().optional(),
      startDate: Joi.date().iso().allow(null).optional(),
      endDate: Joi.date().iso().allow(null).optional(),
      teamId: Joi.string().allow(null).optional(),
      tlUserId: Joi.string().allow(null).optional(),
      managerUserId: Joi.string().allow(null).optional(),
      memberUserIds: memberUserIdsSchema.allow(null),
    }),
  }),

  updateProgress: validate({
    body: Joi.object({
      percent: Joi.number().integer().min(0).max(100).required(),
      note: Joi.string().max(2000).optional(),
    }),
  }),

  projectIdParams: validate({
    params: Joi.object({
      id: Joi.string().required(),
    }),
  }),

  listProjects: validate({
    query: Joi.object({
      status: projectStatusSchema.optional(),
      teamId: Joi.string().optional(),
      tlUserId: Joi.string().optional(),
      managerUserId: Joi.string().optional(),
      clientName: Joi.string().optional(),
      from: Joi.date().iso().optional(),
      to: Joi.date().iso().optional(),
      includeInactive: Joi.boolean().optional(),
    }),
  }),

  summaryReport: validate({
    query: Joi.object({
      from: Joi.date().iso().optional(),
      to: Joi.date().iso().optional(),
      tlUserId: Joi.string().optional(),
    }),
  }),

  overviewReport: validate({
    query: Joi.object({
      from: Joi.date().iso().optional(),
      to: Joi.date().iso().optional(),
      tlUserId: Joi.string().optional(),
      status: projectStatusSchema.optional(),
    }),
  }),
} as const;
