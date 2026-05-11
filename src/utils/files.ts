import path from "path";
import fs from "fs";

export function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

export function safeJoin(...parts: string[]) {
  return path.join(...parts);
}
