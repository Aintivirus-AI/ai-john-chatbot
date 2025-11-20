import os from "node:os";

import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    hostname: os.hostname()
  });
});

