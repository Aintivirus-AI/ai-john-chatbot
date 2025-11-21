import type { NextFunction, Request, Response } from "express";

import { getCachedPersonaResponse } from "../lib/cache.js";
import { needsFreshAnswer } from "../lib/freshness.js";
import type { PersonaMessage } from "../lib/openai.js";

const MAX_CONTEXT_MESSAGES = 8;

function shouldBypassCache(messages: PersonaMessage[] = [], useSearch?: boolean): boolean {
  if (useSearch) {
    return true;
  }

  const latestUser = [...messages].reverse().find((message) => message.role === "user");
  return latestUser?.content ? needsFreshAnswer(latestUser.content) : false;
}

export function cacheMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "POST" || req.path !== "/api/chat") {
    return next();
  }

  if (!req.body || typeof req.body !== "object" || !Array.isArray(req.body.messages)) {
    return next();
  }

  const messages = req.body.messages as PersonaMessage[];
  const bypassCache = shouldBypassCache(messages, Boolean(req.body.useSearch));

  if (bypassCache) {
    res.locals.shouldCache = false;
    res.locals.cacheKey = null;
    return next();
  }

  const limitedMessages = messages.slice(-MAX_CONTEXT_MESSAGES);
  const { cacheKey, cached } = getCachedPersonaResponse(limitedMessages);

  res.locals.shouldCache = true;
  res.locals.cacheKey = cacheKey;

  if (!cacheKey || !cached) {
    return next();
  }

  res.setHeader("X-Cache", "HIT");
  const { citations: _citations, ...rest } = cached;
  return res.json({
    ...rest,
    fromCache: true
  });
}

