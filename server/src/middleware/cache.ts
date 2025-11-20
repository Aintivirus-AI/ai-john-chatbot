import type { NextFunction, Request, Response } from "express";

import { getCachedPersonaResponse } from "../lib/cache.js";

const MAX_CONTEXT_MESSAGES = 8;

export function cacheMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "POST" || req.path !== "/api/chat") {
    return next();
  }

  // Validate request body structure before accessing
  if (!req.body || typeof req.body !== "object" || !Array.isArray(req.body.messages)) {
    return next();
  }

  const messages = req.body.messages;
  const limitedMessages = messages.slice(-MAX_CONTEXT_MESSAGES);
  const { cacheKey, cached } = getCachedPersonaResponse(limitedMessages);

  if (!cacheKey || !cached) {
    res.locals.cacheKey = cacheKey;
    return next();
  }

  res.setHeader("X-Cache", "HIT");
  const { citations: _citations, ...rest } = cached;
  return res.json({
    ...rest,
    fromCache: true
  });
}

