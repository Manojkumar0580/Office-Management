import type { NextFunction, Request, Response } from "express";
import type Joi from "joi";
import { ApiError } from "../utils/apiError";

export type ValidationSchemas = {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
};

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        const { value, error } = schemas.body.validate(req.body, {
          abortEarly: false,
          stripUnknown: true,
        });
        if (error) throw new ApiError(400, "Invalid request body", error.details);
        Object.defineProperty(req, "body", {
          value: value,
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }

      if (schemas.query) {
        const { value, error } = schemas.query.validate(req.query, {
          abortEarly: false,
          stripUnknown: true,
        });
        if (error) throw new ApiError(400, "Invalid request query", error.details);
        Object.defineProperty(req, "query", {
          value: value,
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }

      if (schemas.params) {
        const { value, error } = schemas.params.validate(req.params, {
          abortEarly: false,
          stripUnknown: true,
        });
        if (error) throw new ApiError(400, "Invalid request params", error.details);
        Object.defineProperty(req, "params", {
          value: value,
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
