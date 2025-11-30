import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { config } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFound.js";
import { healthRouter } from "./routes/health.js";
import { chatRouter } from "./routes/chat.js";
import { logger } from "./logger.js";
import { rateLimitMiddleware } from "./middleware/rateLimit.js";
import { cacheMiddleware } from "./middleware/cache.js";

const allowedOrigins = config.allowedOrigins
  ?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const app = express();

app.set("trust proxy", 1);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (!allowedOrigins?.length) {
        return callback(new Error("Origin not allowed by CORS policy"));
      }

      return allowedOrigins.includes(origin) ? callback(null, true) : callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);

app.use(helmet());
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(rateLimitMiddleware);

app.use(
  morgan(config.isProduction ? "combined" : "dev", {
    stream: {
      write: (message: string) => logger.info(message.trim())
    }
  })
);

app.use(cacheMiddleware);
app.use("/health", healthRouter);
app.use("/api/chat", chatRouter);

app.use(notFoundHandler);
app.use(errorHandler);

