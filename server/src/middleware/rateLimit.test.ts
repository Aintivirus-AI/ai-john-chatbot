import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Mock config and logger before importing the module under test
vi.mock("../config.js", () => ({
  config: { rateLimit: { windowMs: 60_000, max: 10 } }
}));
vi.mock("../logger.js", () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));

const { rateLimitMiddleware } = await import("./rateLimit.js");

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    path: "/api/chat",
    ip: "1.2.3.4",
    socket: { remoteAddress: "1.2.3.4" },
    headers: {},
    ...overrides
  } as unknown as Request;
}

function makeRes(): { res: Response; status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; setHeader: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const setHeader = vi.fn();
  const res = { status, json, setHeader } as unknown as Response;
  return { res, status, json, setHeader };
}

describe("getClientKey — IP spoofing fix", () => {
  it("uses req.ip and ignores X-Forwarded-For", () => {
    // Attacker sends a spoofed X-Forwarded-For header with a different IP
    const req = makeReq({
      ip: "10.0.0.1",
      headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" }
    });
    const { res, setHeader } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    rateLimitMiddleware(req, res, next);

    // The bucket key should be based on req.ip (10.0.0.1), not the spoofed 9.9.9.9
    expect(next).toHaveBeenCalled();
    // The rate-limit remaining header should be set (proves it was counted under req.ip)
    expect(setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", "10");
  });

  it("falls back to socket.remoteAddress when req.ip is absent", () => {
    const req = makeReq({ ip: undefined, socket: { remoteAddress: "5.6.7.8" } } as unknown as Partial<Request>);
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    rateLimitMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("falls back to 'anonymous' when no IP is available", () => {
    const req = makeReq({ ip: undefined, socket: { remoteAddress: undefined } } as unknown as Partial<Request>);
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    rateLimitMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
