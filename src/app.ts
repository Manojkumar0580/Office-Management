import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";

import { v1Router } from "./routes/v1";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { ensureDir } from "./utils/files";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  // Larger limit to allow base64-encoded images in JSON bodies (up to ~25MB raw → ~33MB base64).
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use(morgan("dev"));

  app.get("/health", (_req, res) => {
    res.json({
      status: true,
      statusCode: 200,
      message: "Service is running.",
    });
  });

  // Static serving of uploaded files (images, certificates, etc.)
  const uploadRoot = path.join(process.cwd(), "uploads");
  ensureDir(uploadRoot);
  app.use("/uploads", express.static(uploadRoot));

  app.use("/api/v1", v1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
