import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We test validateWebhookSecret by importing it after mocking the config module.
// vitest's module mocking lets us control config.telegram.webhookSecret per test.

describe("validateWebhookSecret", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false when TELEGRAM_WEBHOOK_SECRET is not configured (was previously true — the vulnerability)", async () => {
    vi.doMock("../config.js", () => ({
      config: { telegram: { webhookSecret: undefined } }
    }));
    vi.doMock("../logger.js", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
    const { validateWebhookSecret } = await import("../lib/telegram.js");
    expect(validateWebhookSecret(undefined)).toBe(false);
    expect(validateWebhookSecret("anything")).toBe(false);
  });

  it("returns false when secret is configured but no token is provided", async () => {
    vi.doMock("../config.js", () => ({
      config: { telegram: { webhookSecret: "supersecret" } }
    }));
    vi.doMock("../logger.js", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
    const { validateWebhookSecret } = await import("../lib/telegram.js");
    expect(validateWebhookSecret(undefined)).toBe(false);
  });

  it("returns false for a wrong secret", async () => {
    vi.doMock("../config.js", () => ({
      config: { telegram: { webhookSecret: "supersecret" } }
    }));
    vi.doMock("../logger.js", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
    const { validateWebhookSecret } = await import("../lib/telegram.js");
    expect(validateWebhookSecret("wrongsecret")).toBe(false);
  });

  it("returns true for the correct secret", async () => {
    vi.doMock("../config.js", () => ({
      config: { telegram: { webhookSecret: "supersecret" } }
    }));
    vi.doMock("../logger.js", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
    const { validateWebhookSecret } = await import("../lib/telegram.js");
    expect(validateWebhookSecret("supersecret")).toBe(true);
  });

  it("returns false when provided secret length differs (constant-time guard)", async () => {
    vi.doMock("../config.js", () => ({
      config: { telegram: { webhookSecret: "abc" } }
    }));
    vi.doMock("../logger.js", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
    const { validateWebhookSecret } = await import("../lib/telegram.js");
    expect(validateWebhookSecret("ab")).toBe(false);
    expect(validateWebhookSecret("abcd")).toBe(false);
  });
});
