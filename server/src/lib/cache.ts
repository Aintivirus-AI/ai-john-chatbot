import crypto from "node:crypto";

import { LRUCache } from "lru-cache";

import { config } from "../config.js";
import type { PersonaMessage, PersonaResponse } from "./openai.js";

export const responseCache = new LRUCache<string, PersonaResponse>({
  max: config.cache.maxEntries,
  ttl: config.cache.ttlMs
});

export function buildCacheKey(messages: PersonaMessage[] = []): string | null {
  if (!messages.length) {
    return null;
  }

  const normalized = messages
    .map((message) => `${message.role}:${normalizeText(message.content)}`)
    .join("|");

  if (!normalized.trim()) {
    return null;
  }

  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function getCachedPersonaResponse(messages: PersonaMessage[]) {
  const cacheKey = buildCacheKey(messages);
  if (!cacheKey) {
    return { cacheKey: null, cached: null };
  }
  const cached = responseCache.get(cacheKey);
  return { cacheKey, cached: cached ? { ...cached, fromCache: true } : null };
}

export function setCachedPersonaResponse(cacheKey: string | null, response: PersonaResponse) {
  if (!cacheKey) {
    return;
  }

  responseCache.set(cacheKey, { ...response, fromCache: false });
}

