import { LRUCache } from "lru-cache";

import { config } from "../config.js";
import type { PersonaMessage } from "./openai.js";

interface ConversationSession {
  messages: PersonaMessage[];
  lastActivity: number;
}

const conversationCache = new LRUCache<string, ConversationSession>({
  max: 1000, // Max concurrent conversations
  ttl: config.telegram.sessionTtlMs
});

/**
 * Get conversation history for a user
 */
export function getConversation(userId: string): PersonaMessage[] {
  const session = conversationCache.get(userId);
  return session?.messages ?? [];
}

/**
 * Add a message to a user's conversation history
 */
export function addMessage(userId: string, message: PersonaMessage): void {
  const session = conversationCache.get(userId) ?? {
    messages: [],
    lastActivity: Date.now()
  };

  session.messages.push(message);

  // Trim to max history length (keep most recent)
  if (session.messages.length > config.telegram.maxHistory) {
    session.messages = session.messages.slice(-config.telegram.maxHistory);
  }

  session.lastActivity = Date.now();
  conversationCache.set(userId, session);
}

/**
 * Clear a user's conversation history
 */
export function clearConversation(userId: string): void {
  conversationCache.delete(userId);
}

/**
 * Get stats about the conversation store
 */
export function getStoreStats(): { activeConversations: number } {
  return {
    activeConversations: conversationCache.size
  };
}

