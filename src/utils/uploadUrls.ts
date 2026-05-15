import type { Request } from "express";
import path from "path";

/** Store and serve upload paths with forward slashes (works on Windows too). */
export function normalizeUploadRelativePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.startsWith("uploads/")) return normalized;
  const base = path.basename(normalized);
  return `uploads/${base}`;
}

export function getPublicBaseUrl(req?: Request): string {
  const fromEnv = process.env.APP_PUBLIC_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (req) {
    const host = req.get("host");
    if (host) return `${req.protocol}://${host}`;
  }
  const port = process.env.PORT ?? "3000";
  return `http://localhost:${port}`;
}

export function toPublicUploadUrl(relativePath: string, baseUrl: string): string {
  const rel = normalizeUploadRelativePath(relativePath);
  return `${baseUrl.replace(/\/$/, "")}/${rel}`;
}

const PATH_KEYS = new Set(["filePath", "livePhotoPath", "cvPath"]);

/**
 * Adds a sibling `url` (and `livePhotoUrl` / `cvUrl`) for each stored upload path in JSON responses.
 */
export function enrichUploadPathsInJson<T>(data: T, baseUrl: string): T {
  return walk(data, baseUrl) as T;
}

function walk(value: unknown, baseUrl: string): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => walk(item, baseUrl));
  if (value instanceof Date) return value;
  if (typeof value !== "object") return value;

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(obj)) {
    if (PATH_KEYS.has(key) && typeof val === "string" && val.length > 0) {
      const normalized = normalizeUploadRelativePath(val);
      out[key] = normalized;
      const urlKey = key === "livePhotoPath" ? "livePhotoUrl" : key === "cvPath" ? "cvUrl" : "url";
      out[urlKey] = toPublicUploadUrl(normalized, baseUrl);
      continue;
    }
    out[key] = walk(val, baseUrl);
  }

  return out;
}
