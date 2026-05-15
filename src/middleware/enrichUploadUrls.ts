import type { NextFunction, Request, Response } from "express";
import { enrichUploadPathsInJson, getPublicBaseUrl } from "../utils/uploadUrls";

/**
 * Injects absolute image URLs into JSON success payloads (`data.filePath` → `data.url`, etc.).
 */
export function enrichUploadUrlsMiddleware(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);

  res.json = function jsonWithUploadUrls(body: unknown) {
    if (body && typeof body === "object" && body !== null && "data" in body) {
      const record = body as Record<string, unknown>;
      if (record.data !== undefined) {
        const baseUrl = getPublicBaseUrl(req);
        return originalJson({
          ...record,
          data: enrichUploadPathsInJson(record.data, baseUrl),
        });
      }
    }
    return originalJson(body);
  };

  next();
}
