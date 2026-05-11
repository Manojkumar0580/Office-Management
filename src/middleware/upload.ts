import multer from "multer";
import path from "path";
import crypto from "crypto";
import { ensureDir } from "../utils/files";

const uploadRoot = path.join(process.cwd(), "uploads");
ensureDir(uploadRoot);

function randomName(originalName: string) {
  const ext = path.extname(originalName);
  const base = crypto.randomBytes(16).toString("hex");
  return `${base}${ext}`;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadRoot);
  },
  filename: (_req, file, cb) => {
    cb(null, randomName(file.originalname));
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
});
