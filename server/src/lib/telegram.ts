import { config } from "../config.js";
import { logger } from "../logger.js";
import { generatePersonaResponse } from "./openai.js";
import { searchBackedPersonaResponse } from "./search.js";
import { needsFreshAnswer } from "./freshness.js";
import { getConversation, addMessage, clearConversation } from "./conversationStore.js";
import type { PersonaMessage } from "./openai.js";

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

/**
 * Send a message via Telegram API
 */
async function sendMessage(chatId: number, text: string): Promise<void> {
  const token = config.telegram.botToken;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const response = await fetch(`${TELEGRAM_API_BASE}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown"
    })
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error({ chatId, error }, "Failed to send Telegram message");
    
    // Retry without markdown if it failed (in case of formatting issues)
    const retryResponse = await fetch(`${TELEGRAM_API_BASE}${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text
      })
    });
    
    if (!retryResponse.ok) {
      throw new Error(`Telegram API error: ${error}`);
    }
  }
}

/**
 * Send a "typing" indicator to show the bot is processing
 */
async function sendTypingIndicator(chatId: number): Promise<void> {
  const token = config.telegram.botToken;
  if (!token) return;

  try {
    await fetch(`${TELEGRAM_API_BASE}${token}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        action: "typing"
      })
    });
  } catch (error) {
    // Non-critical, just log and continue
    logger.warn({ error }, "Failed to send typing indicator");
  }
}

/**
 * Handle a /start command
 */
function handleStartCommand(userId: string): string {
  clearConversation(userId);
  return "Hey there. John McAfee here. What's on your mind?";
}

/**
 * Handle a /clear command
 */
function handleClearCommand(userId: string): string {
  clearConversation(userId);
  return "Memory wiped. Fresh start. What do you want to talk about?";
}

/**
 * Process an incoming Telegram update
 */
export async function processUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  
  if (!message?.text || !message.from) {
    logger.debug({ update }, "Ignoring non-text update");
    return;
  }

  const chatId = message.chat.id;
  const userId = String(message.from.id);
  const text = message.text.trim();

  logger.info(
    { userId, chatId, messageLength: text.length },
    "Processing Telegram message"
  );

  // Handle commands
  if (text.startsWith("/start")) {
    const response = handleStartCommand(userId);
    await sendMessage(chatId, response);
    return;
  }

  if (text.startsWith("/clear")) {
    const response = handleClearCommand(userId);
    await sendMessage(chatId, response);
    return;
  }

  // Show typing indicator while processing
  await sendTypingIndicator(chatId);

  try {
    // Get conversation history and add new message
    const history = getConversation(userId);
    const userMessage: PersonaMessage = { role: "user", content: text };
    const messages = [...history, userMessage];

    // Determine if we need web search
    const shouldSearch = needsFreshAnswer(text);

    // Generate response using the persona engine
    const personaResponse = shouldSearch
      ? await searchBackedPersonaResponse(messages)
      : await generatePersonaResponse(messages);

    // Store messages in history
    addMessage(userId, userMessage);
    addMessage(userId, { role: "assistant", content: personaResponse.text });

    // Send response
    await sendMessage(chatId, personaResponse.text);

    logger.info(
      { userId, responseLength: personaResponse.text.length, usedSearch: shouldSearch },
      "Sent Telegram response"
    );
  } catch (error) {
    logger.error({ error, userId }, "Failed to process Telegram message");
    await sendMessage(
      chatId,
      "Something went sideways in the matrix. Give it another shot."
    );
  }
}

/**
 * Validate webhook request using secret token
 */
export function validateWebhookSecret(providedSecret: string | undefined): boolean {
  const expectedSecret = config.telegram.webhookSecret;
  
  // If no secret configured, allow all (for development)
  if (!expectedSecret) {
    return true;
  }

  return providedSecret === expectedSecret;
}

/**
 * Set up the webhook with Telegram
 * Call this once after deployment to register your webhook URL
 */
export async function registerWebhook(webhookUrl: string): Promise<boolean> {
  const token = config.telegram.botToken;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const params: Record<string, string> = {
    url: webhookUrl
  };

  // Add secret token if configured
  if (config.telegram.webhookSecret) {
    params.secret_token = config.telegram.webhookSecret;
  }

  const response = await fetch(`${TELEGRAM_API_BASE}${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });

  const result = await response.json() as { ok: boolean; description?: string };
  
  if (!result.ok) {
    logger.error({ result }, "Failed to register Telegram webhook");
    return false;
  }

  logger.info({ webhookUrl }, "Telegram webhook registered successfully");
  return true;
}

/**
 * Get current webhook info from Telegram
 */
export async function getWebhookInfo(): Promise<unknown> {
  const token = config.telegram.botToken;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const response = await fetch(`${TELEGRAM_API_BASE}${token}/getWebhookInfo`);
  return response.json();
}

