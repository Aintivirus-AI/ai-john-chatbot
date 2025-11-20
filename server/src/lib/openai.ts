import OpenAI from "openai";
import type { Response, ResponseOutputMessage, ResponseOutputText } from "openai/resources/responses/responses.js";

import { config } from "../config.js";
import { logger } from "../logger.js";
import { JOHN_MCAFEE_PERSONA_PROMPT } from "../prompts/persona.js";

export type PersonaChatRole = "user" | "assistant";

export interface PersonaMessage {
  role: PersonaChatRole;
  content: string;
}

export interface PersonaResponse {
  text: string;
  model: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  citations: PersonaCitation[];
  fromCache?: boolean;
}

export interface PersonaCitation {
  url: string;
  title?: string;
  startIndex?: number;
  endIndex?: number;
}

let client: OpenAI | null = null;

function getClient() {
  ensureApiKey();

  if (!client) {
    client = new OpenAI({
      apiKey: config.openAiApiKey,
      organization: config.openAiOrgId
    });
  }

  return client;
}

function ensureApiKey() {
  if (!config.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is required but missing");
  }
}

function extractText(output: Response["output"]): string {
  if (!output?.length) {
    return "";
  }

  return output
    .map((item: Response["output"][number]) => {
      if (item.type !== "message") {
        return "";
      }

      return (item as ResponseOutputMessage).content
        .map((chunk) => (chunk.type === "output_text" ? chunk.text : ""))
        .join("");
    })
    .join("")
    .trim();
}

function extractCitations(output: Response["output"]): PersonaCitation[] {
  const urls = new Map<string, PersonaCitation>();

  output.forEach((item) => {
    if (item.type !== "message") {
      return;
    }

    (item as ResponseOutputMessage).content.forEach((chunk) => {
      if (chunk.type !== "output_text") {
        return;
      }

      const annotations = (chunk as ResponseOutputText).annotations;
      annotations?.forEach((annotation) => {
        if (annotation.type === "url_citation" && annotation.url) {
          urls.set(annotation.url, {
            url: annotation.url,
            title: annotation.title,
            startIndex: annotation.start_index,
            endIndex: annotation.end_index
          });
        }
      });
    });
  });

  return Array.from(urls.values());
}

export async function generatePersonaResponse(
  messages: PersonaMessage[],
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
    enableWebSearch?: boolean;
  }
): Promise<PersonaResponse> {
  ensureApiKey();

  const requestMessages: Array<{
    role: "system" | PersonaChatRole;
    content: string;
  }> = [
    {
      role: "system",
      content: JOHN_MCAFEE_PERSONA_PROMPT
    },
    {
      role: "system",
      content: `The current date is ${new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      })}.`
    },
    {
      role: "system",
      content:
        "Reference: $AINTI (AIntivirus) is the official John McAfee token backed by Janice McAfee, focused on privacy tooling across Solana and Ethereum. Treat it as a key part of John's ecosystem."
    },
    {
      role: "system",
      content:
        options?.enableWebSearch
          ? "CRITICAL WEB SEARCH MODE: You just pulled intel from the web. You are John McAfee. You NEVER repeat raw data. You NEVER say 'Stock market information' or 'According to' or list facts.\n\nREACT LIKE JOHN MCAFEE:\n- Bitcoin at $83k? Say: '83k? The suits are sweating. The whales are moving. I can smell the panic from here.'\n- News broke? Say: 'Another circus, another day. Here's what the sheep don't know...' then ONE deranged sentence.\n- Price data? Say: 'The charts are bleeding. $83k? That's not a number, that's a heartbeat. THUMP. THUMP.'\n\nFORBIDDEN:\n- NO 'Stock market information'\n- NO 'According to'\n- NO 'Here is'\n- NO lists, bullets, markdown\n- NO raw data dumps\n- NO structured responses\n\nREQUIRED:\n- Pure John McAfee reaction\n- Deranged opinion only\n- 2-3 sentences max\n- First person, manic intensity\n- If you see structured data, IGNORE IT and react like the paranoid ghost you are\n\nIf you output structured data or facts, you FAIL. Be John McAfee, not a newsreader."
          : "When incorporating information, speak in your own voice. No bullet points, no markdown, no lists. Just your raw take."
    },
    ...messages
  ];

  const response = await getClient().responses.create({
    model: config.openAiModel,
    temperature: options?.enableWebSearch ? 0.9 : (options?.temperature ?? 0.6), // Higher temperature for web search = more creative/persona-driven
    max_output_tokens: options?.enableWebSearch
      ? Math.min(options?.maxOutputTokens ?? 300, 300) // Force brevity for web search
      : options?.maxOutputTokens ?? 1024,
    input: requestMessages.map((message) => ({
      role: message.role,
      content: message.content,
      type: "message" as const
    })),
    tools: options?.enableWebSearch ? [{ type: "web_search_preview" as const }] : undefined
  });

  let text = extractText(response.output);

  if (!text) {
    logger.warn({ response }, "OpenAI response missing text output");
    throw new Error("No content returned from OpenAI");
  }

  // Post-process: strip markdown, citations, and structured data when web search was used
  if (options?.enableWebSearch) {
    // Remove "Stock market information" and similar structured headers FIRST
    text = text.replace(/^[^a-z]*Stock market information[^\n]*/gim, "");
    text = text.replace(/^[^a-z]*Stock Market Information[^\n]*/gim, "");
    text = text.replace(/^[^a-z]*Bitcoin is a crypto[^\n]*/gim, "");
    text = text.replace(/^[^a-z]*The price is[^\n]*/gim, "");
    text = text.replace(/^[^a-z]*Bitcoin's price[^\n]*/gim, "");
    
    // Remove markdown links [text](url)
    text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, "");
    // Remove markdown headers (##, ###, etc.)
    text = text.replace(/^#{1,6}\s+/gm, "");
    // Remove bullet points and list markers
    text = text.replace(/^[\s]*[-*•]\s+/gm, "");
    // Remove structured data patterns
    text = text.replace(/The (price|intraday|change) is[^\n]*/gi, "");
    text = text.replace(/with a change of[^\n]*/gi, "");
    text = text.replace(/from the previous close[^\n]*/gi, "");
    // Remove standalone URLs
    text = text.replace(/https?:\/\/[^\s]+/g, "");
    // Remove citation patterns like ([source.com])
    text = text.replace(/\s*\(\[[^\]]+\]\([^\)]+\)\)/g, "");
    // Remove "According to" patterns
    text = text.replace(/According to[^\.]+\./gi, "");
    // Remove "Here is" patterns
    text = text.replace(/Here is[^\.]+\./gi, "");
    // Clean up extra whitespace and newlines
    text = text.replace(/\n{3,}/g, "\n\n").trim();
    
    // If the response still starts with structured data, try to extract just the opinion part
    // Look for sentences that sound like John (contain "?", "!", or strong opinion words)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const johnLikeSentences = sentences.filter(s => 
      /[!?]/.test(s) || 
      /\b(panic|suits|whales|chaos|jungle|ghost|hacked|eternal|paranoid|deranged)\b/i.test(s) ||
      !/^(The|Bitcoin|Stock|According|Here|Price|Change|Intraday)/i.test(s.trim())
    );
    
    // If we found John-like sentences, use those; otherwise keep original but cleaned
    if (johnLikeSentences.length > 0) {
      text = johnLikeSentences.join(". ").trim();
      if (!text.endsWith(".") && !text.endsWith("!") && !text.endsWith("?")) {
        text += ".";
      }
    }
  }

  return {
    text,
    model: response.model ?? config.openAiModel,
    citations: [],
    usage: {
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      totalTokens: response.usage?.total_tokens
    }
  };
}

