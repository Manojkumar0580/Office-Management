import path from "path";
import fs from "fs";
import crypto from "crypto";
import { ApiError } from "./apiError";
import { ensureDir } from "./files";
import { normalizeUploadRelativePath } from "./uploadUrls";

const uploadRoot = path.join(process.cwd(), "uploads");
ensureDir(uploadRoot);

const MAX_BYTES = 25 * 1024 * 1024; // 25MB per image

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "application/pdf": ".pdf",
};

export type Base64ImageInput =
  | string
  | {
      data: string;
      mimeType?: string;
      originalName?: string;
    };

export type SavedImage = {
  originalName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
};

/**
 * Accepts either a data URL ("data:image/png;base64,XXXX"),
 * a raw base64 string, or an object { data, mimeType, originalName }.
 * Decodes, validates, and writes the file to disk under /uploads.
 */
export function saveBase64Image(input: Base64ImageInput): SavedImage {
  let raw: string;
  let mimeType: string | undefined;
  let originalName: string | undefined;

  if (typeof input === "string") {
    raw = input;
  } else {
    raw = input.data;
    mimeType = input.mimeType;
    originalName = input.originalName;
  }

  if (!raw || typeof raw !== "string") {
    throw new ApiError(400, "Invalid base64 image payload");
  }

  // Strip data URL prefix if present and capture the mime type from it.
  const dataUrlMatch = raw.match(/^data:([\w./+-]+);base64,(.*)$/);
  if (dataUrlMatch) {
    if (!mimeType) mimeType = dataUrlMatch[1];
    raw = dataUrlMatch[2];
  }

  raw = raw.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/=]+$/.test(raw)) {
    throw new ApiError(400, "Invalid base64 image data");
  }

  const buffer = Buffer.from(raw, "base64");
  if (buffer.length === 0) {
    throw new ApiError(400, "Empty base64 image data");
  }
  if (buffer.length > MAX_BYTES) {
    throw new ApiError(413, "Image exceeds maximum size of 25MB");
  }

  const detectedMime = mimeType ?? detectMimeFromBuffer(buffer);
  if (!detectedMime || !ALLOWED_MIME_TO_EXT[detectedMime]) {
    throw new ApiError(415, "Unsupported format. Allowed: jpeg, png, webp, gif, heic, pdf");
  }

  const ext = ALLOWED_MIME_TO_EXT[detectedMime];
  const fileName = `${crypto.randomBytes(16).toString("hex")}${ext}`;
  const absolutePath = path.join(uploadRoot, fileName);
  fs.writeFileSync(absolutePath, buffer);

  const relativePath = normalizeUploadRelativePath(path.posix.join("uploads", fileName));

  return {
    originalName: originalName ?? fileName,
    filePath: relativePath,
    mimeType: detectedMime,
    sizeBytes: buffer.length,
    uploadedAt: new Date(),
  };
}

export function saveBase64Images(inputs: Base64ImageInput[] | undefined): SavedImage[] {
  if (!inputs || inputs.length === 0) return [];
  return inputs.map((i) => saveBase64Image(i));
}

function detectMimeFromBuffer(buf: Buffer): string | undefined {
  if (buf.length < 12) return undefined;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }

  // GIF: "GIF87a" or "GIF89a"
  if (
    buf.slice(0, 6).toString("ascii") === "GIF87a" ||
    buf.slice(0, 6).toString("ascii") === "GIF89a"
  ) {
    return "image/gif";
  }

  // WEBP: "RIFF....WEBP"
  if (
    buf.slice(0, 4).toString("ascii") === "RIFF" &&
    buf.slice(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  // PDF: %PDF-
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2d) {
    return "application/pdf";
  }

  // HEIC: "ftypheic" / "ftypheix" / "ftyphevc" at offset 4
  const ftyp = buf.slice(4, 12).toString("ascii");
  if (ftyp.startsWith("ftypheic") || ftyp.startsWith("ftypheix") || ftyp.startsWith("ftyphevc")) {
    return "image/heic";
  }

  return undefined;
}
