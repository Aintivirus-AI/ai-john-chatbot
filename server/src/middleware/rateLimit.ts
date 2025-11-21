import type { NextFunction, Request, Response } from "express";

import { config } from "../config.js";
import { logger } from "../logger.js";

type RateRecord = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateRecord>();

const RATE_LIMITED_PATHS = [/^\/api\//i];

// Cleanup old buckets periodically to prevent memory leaks
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, record] of buckets.entries()) {
    if (record.resetAt <= now) {
      buckets.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug({ cleaned }, "Cleaned up expired rate limit buckets");
  }
}, CLEANUP_INTERVAL_MS);

function shouldRateLimit(path: string) {
  return RATE_LIMITED_PATHS.some((regex) => regex.test(path));
}

function getClientKey(req: Request) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0].trim();
  }
  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0];
  }
  return req.ip || req.socket.remoteAddress || "anonymous";
}

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!shouldRateLimit(req.path)) {
    return next();
  }

  const key = getClientKey(req);
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + config.rateLimit.windowMs });
    attachHeaders(res, config.rateLimit.max - 1, now + config.rateLimit.windowMs);
    return next();
  }

  if (existing.count >= config.rateLimit.max) {
    const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);
    logger.warn({ key, path: req.path }, "Rate limit exceeded");
    res.setHeader("Retry-After", String(retryAfterSeconds));
    attachHeaders(res, 0, existing.resetAt);
    return res.status(429).json({
      error: "Easy there. You're hitting this endpoint too fast.",
      retryAfterSeconds
    });
  }

  existing.count += 1;
  attachHeaders(res, config.rateLimit.max - existing.count, existing.resetAt);
  return next();
}

function attachHeaders(res: Response, remaining: number, resetAt: number) {
  res.setHeader("X-RateLimit-Limit", String(config.rateLimit.max));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(remaining, 0)));
  res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
}

