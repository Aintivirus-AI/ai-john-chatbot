import { config } from "../config.js";
import { logger } from "../logger.js";
import type { PersonaMessage, PersonaResponse } from "./openai.js";
import { generatePersonaResponse } from "./openai.js";

const DEFAULT_SEARCH_FALLBACK =
  "My web recon scraped a dead end. Give me a moment and try again, or tighten the query.";

export async function searchBackedPersonaResponse(
  messages: PersonaMessage[],
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
    fallbackMessage?: string;
  }
): Promise<PersonaResponse> {
  try {
    return await generatePersonaResponse(messages, {
      temperature: options?.temperature,
      maxOutputTokens: options?.maxOutputTokens,
      enableWebSearch: true
    });
  } catch (error) {
    logger.error({ error }, "Search-backed persona response failed");
    return {
      text: options?.fallbackMessage ?? DEFAULT_SEARCH_FALLBACK,
      model: config.openAiModel,
      citations: [],
      usage: undefined,
      meta: {
        usedFallback: true
      }
    };
  }
}

