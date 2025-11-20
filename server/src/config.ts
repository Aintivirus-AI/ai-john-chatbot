import path from "node:path";
import process from "node:process";

import dotenv from "dotenv";
import { z } from "zod";

const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  OPENAI_ORG_ID: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(30),
  CACHE_TTL_SECONDS: z.coerce.number().int().min(30).default(120),
  CACHE_MAX_ENTRIES: z.coerce.number().int().min(10).default(200)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Use logger if available, otherwise console.error as fallback
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "test") {
    // eslint-disable-next-line no-console
    console.error("❌ Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  }
  throw new Error("Invalid environment configuration");
}

const env = parsed.data;

// Validate production requirements after parsing
if (env.NODE_ENV === "production" && !env.OPENAI_API_KEY) {
  // eslint-disable-next-line no-console
  console.error("❌ OPENAI_API_KEY is required in production");
  throw new Error("OPENAI_API_KEY is required in production");
}

export const config = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  port: env.PORT,
  openAiApiKey: env.OPENAI_API_KEY,
  openAiModel: env.OPENAI_MODEL,
  openAiOrgId: env.OPENAI_ORG_ID,
  allowedOrigins: env.ALLOWED_ORIGINS,
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX
  },
  cache: {
    ttlMs: env.CACHE_TTL_SECONDS * 1000,
    maxEntries: env.CACHE_MAX_ENTRIES
  }
};

