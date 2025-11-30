import type { ErrorRequestHandler } from "express";

import { config } from "../config.js";
import { logger } from "../logger.js";

type KnownError = Error & {
  status?: number;
  statusCode?: number;
};

export const errorHandler: ErrorRequestHandler = (err: KnownError, req, res, _next) => {
  const status = err.status ?? err.statusCode ?? 500;
  const message = status >= 500 ? "Internal server error" : err.message;

  logger.error(
    {
      err: config.isProduction ? { message: err.message, name: err.name } : err,
      path: req.path,
      method: req.method,
      status
    },
    err.message
  );

  res.status(status).json({ 
    error: message,
    ...(status < 500 && !config.isProduction ? { details: err.message } : {})
  });
};

