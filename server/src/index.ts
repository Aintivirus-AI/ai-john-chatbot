import http from "node:http";
import process from "node:process";

import { app } from "./app.js";
import { config } from "./config.js";
import { logger } from "./logger.js";

const server = http.createServer(app);

server.listen(config.port, () => {
  logger.info(`🚀 Service ready on http://localhost:${config.port}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = typeof config.port === "string" ? `Pipe ${config.port}` : `Port ${config.port}`;

  switch (error.code) {
    case "EACCES":
      logger.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case "EADDRINUSE":
      logger.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

const gracefulShutdown = (signal: NodeJS.Signals) => {
  logger.warn({ signal }, "Received shutdown signal");
  
  const shutdownTimeout = setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000); // 10 second timeout

  server.close((error) => {
    clearTimeout(shutdownTimeout);
    if (error) {
      logger.error(error, "Error shutting down server");
      process.exit(1);
    }
    logger.info("HTTP server closed. Exiting process.");
    process.exit(0);
  });
};

const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

signals.forEach((signal) => {
  process.on(signal, () => gracefulShutdown(signal));
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "Unhandled promise rejection");
  // In production, we might want to exit, but for now just log
  if (config.isProduction) {
    logger.error("Unhandled rejection in production - consider exiting");
  }
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error({ error }, "Uncaught exception");
  // Exit on uncaught exceptions as they indicate a serious problem
  process.exit(1);
});

