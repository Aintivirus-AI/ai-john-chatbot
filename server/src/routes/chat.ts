import { Router } from "express";
import { z } from "zod";

import { setCachedPersonaResponse, buildCacheKey } from "../lib/cache.js";
import { generatePersonaResponse } from "../lib/openai.js";
import type { PersonaMessage, PersonaResponse } from "../lib/openai.js";
import { searchBackedPersonaResponse } from "../lib/search.js";
import { logger } from "../logger.js";
import { needsFreshAnswer } from "../lib/freshness.js";

const router = Router();

const MAX_RESPONSE_CHARS = 2500;
const MAX_CONTEXT_MESSAGES = 8;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z
    .string()
    .min(1, "Message content required")
    .max(MAX_RESPONSE_CHARS, "Message content too long")
});

const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1, "Provide at least one message"),
  useSearch: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().min(64).max(2048).optional()
});

router.post("/", async (req, res) => {
  // Shallow copy to avoid mutating the original request body
  const body = { ...req.body };

  // Aggressively truncate all messages to prevent validation errors
  if (body.messages && Array.isArray(body.messages)) {
    body.messages = body.messages.map((msg: { role: string; content: string }) => {
      if (typeof msg.content === "string") {
        const maxLen = msg.role === "assistant" ? MAX_RESPONSE_CHARS : 2000;
        if (msg.content.length > maxLen) {
          return { ...msg, content: msg.content.slice(0, maxLen - 3) + "..." };
        }
      }
      return msg;
    });
  }

  // If validation still fails, truncate more aggressively and retry
  let parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    // Last resort: truncate everything aggressively
    if (body.messages && Array.isArray(body.messages)) {
      body.messages = body.messages.map((msg: { role: string; content: string }) => {
        if (typeof msg.content === "string") {
          const maxLen = msg.role === "assistant" ? MAX_RESPONSE_CHARS : 2000;
          return { ...msg, content: msg.content.slice(0, Math.min(maxLen - 3, 1000)) + "..." };
        }
        return msg;
      });
    }
    parsed = chatRequestSchema.safeParse(body);
  }

  if (!parsed.success) {
    logger.warn(
      {
        error: parsed.error.flatten(),
        bodySize: JSON.stringify(req.body).length,
        messageCount: Array.isArray(req.body?.messages) ? req.body.messages.length : 0
      },
      "Invalid chat payload after truncation"
    );
    // Don't crash - return a helpful error but don't kill the app
    return res.status(400).json({
      error: "Invalid request payload. Please try sending a shorter message.",
      details: parsed.error.flatten()
    });
  }

  const { messages, useSearch, temperature, maxOutputTokens } = parsed.data;
  const trimmedMessages = limitMessages(messages);
  const latestUserMessage = [...trimmedMessages].reverse().find((message) => message.role === "user");
  const shouldSearch = useSearch ?? (latestUserMessage ? needsFreshAnswer(latestUserMessage.content) : false);

  try {
    const personaResponse = await getPersonaResponse(trimmedMessages, {
      temperature,
      maxOutputTokens,
      enableSearch: shouldSearch
    });

    const shouldCacheResponse =
      res.locals.shouldCache !== false && !shouldSearch && !personaResponse.meta?.usedFallback;

    if (shouldCacheResponse) {
      const cacheKey = res.locals.cacheKey ?? buildCacheKey(trimmedMessages);
      setCachedPersonaResponse(cacheKey, personaResponse);
    }

    const { citations: _citations, ...rest } = personaResponse;

    return res.json({
      ...rest,
      usedSearch: shouldSearch
    });
  } catch (error) {
    logger.error({ error }, "Chat route failed");
    return res.status(500).json({ error: "Something went sideways. Try again shortly." });
  }
});

async function getPersonaResponse(
  messages: PersonaMessage[],
  options: {
    temperature?: number;
    maxOutputTokens?: number;
    enableSearch: boolean;
  }
): Promise<PersonaResponse> {
  if (options.enableSearch) {
    return searchBackedPersonaResponse(messages, {
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens
    });
  }

  return generatePersonaResponse(messages, {
    temperature: options.temperature,
    maxOutputTokens: options.maxOutputTokens
  });
}

function limitMessages(messages: PersonaMessage[]): PersonaMessage[] {
  return messages
    .slice(-MAX_CONTEXT_MESSAGES)
    .map((message) => ({
      ...message,
      content:
        message.role === "assistant" && message.content.length > MAX_RESPONSE_CHARS
          ? `${message.content.slice(0, MAX_RESPONSE_CHARS)} …`
          : message.content
    }));
}

export { router as chatRouter };
