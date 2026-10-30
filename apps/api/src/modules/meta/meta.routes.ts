import { Router } from "express";
import { APP_VERSION, API_VERSION } from "../../version.js";

export const metaRouter = Router();
metaRouter.get("/", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    application: "Baituljannah School Management System",
    version: APP_VERSION,
    apiVersion: API_VERSION,
    environment: process.env.NODE_ENV ?? "development",
  });
});
