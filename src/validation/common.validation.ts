import Joi from "joi";

/**
 * Accepts an image as either:
 *  - a base64 string (with or without "data:image/...;base64," prefix), or
 *  - an object { data, mimeType?, originalName? }.
 */
export const base64ImageSchema = Joi.alternatives().try(
  Joi.string().min(20).max(40_000_000),
  Joi.object({
    data: Joi.string().min(20).max(40_000_000).required(),
    mimeType: Joi.string()
      .valid("image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/heic")
      .optional(),
    originalName: Joi.string().max(255).optional(),
  }),
);

export const base64ImagesArraySchema = Joi.array().items(base64ImageSchema).max(10).optional();
