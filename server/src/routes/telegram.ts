import { Router } from "express";

import { logger } from "../logger.js";
import { config } from "../config.js";
import {
  processUpdate,
  validateWebhookSecret,
  registerWebhook,
  getWebhookInfo,
  type TelegramUpdate
} from "../lib/telegram.js";
import { getStoreStats } from "../lib/conversationStore.js";

const router = Router();

/**
 * Telegram webhook endpoint
 * Telegram sends POST requests here when users message the bot
 */
router.post("/webhook", async (req, res) => {
  // Validate webhook secret (sent in X-Telegram-Bot-Api-Secret-Token header)
  const secretToken = req.headers["x-telegram-bot-api-secret-token"] as string | undefined;
  
  if (!validateWebhookSecret(secretToken)) {
    logger.warn("Invalid Telegram webhook secret");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const update = req.body as TelegramUpdate;

  if (!update?.update_id) {
    logger.warn({ body: req.body }, "Invalid Telegram update format");
    return res.status(400).json({ error: "Invalid update format" });
  }

  // Respond immediately to Telegram (they expect fast response)
  res.status(200).json({ ok: true });

  // Process the update asynchronously
  try {
    await processUpdate(update);
  } catch (error) {
    logger.error({ error, updateId: update.update_id }, "Failed to process Telegram update");
  }
});

/**
 * Register/update webhook URL
 * POST /api/telegram/register-webhook
 * Body: { "url": "https://yourdomain.com/api/telegram/webhook" }
 */
router.post("/register-webhook", async (req, res) => {
  // Only allow in development or with proper auth
  if (config.isProduction) {
    return res.status(403).json({ 
      error: "Use the Telegram API directly in production",
      hint: "curl -X POST 'https://api.telegram.org/bot<token>/setWebhook?url=<webhook_url>'"
    });
  }

  const { url } = req.body;
  
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing webhook URL" });
  }

  try {
    const success = await registerWebhook(url);
    return res.json({ success, url });
  } catch (error) {
    logger.error({ error }, "Failed to register webhook");
    return res.status(500).json({ error: "Failed to register webhook" });
  }
});

/**
 * Get current webhook status
 * GET /api/telegram/webhook-info
 */
router.get("/webhook-info", async (_req, res) => {
  if (!config.telegram.botToken) {
    return res.status(503).json({ error: "Telegram bot not configured" });
  }

  try {
    const info = await getWebhookInfo();
    return res.json(info);
  } catch (error) {
    logger.error({ error }, "Failed to get webhook info");
    return res.status(500).json({ error: "Failed to get webhook info" });
  }
});

/**
 * Get conversation store stats
 * GET /api/telegram/stats
 */
router.get("/stats", (_req, res) => {
  const stats = getStoreStats();
  return res.json({
    ...stats,
    configured: !!config.telegram.botToken
  });
});

export { router as telegramRouter };

