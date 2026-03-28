import { describe, it, expect } from "vitest";
import express from "express";
import { healthRouter } from "./health.js";

function makeApp() {
  const app = express();
  app.use("/health", healthRouter);
  return app;
}

describe("GET /health", () => {
  it("does not expose hostname", async () => {
    const app = makeApp();
    const res = await new Promise<{ body: Record<string, unknown>; statusCode: number }>((resolve) => {
      const req = Object.assign(
        { method: "GET", url: "/health", headers: { host: "localhost" } },
        { socket: {} }
      );
      // Use supertest-style in-process request via express internal listener
      const server = app.listen(0, () => {
        const port = (server.address() as { port: number }).port;
        fetch(`http://localhost:${port}/health`)
          .then((r) => r.json())
          .then((body) => { server.close(); resolve({ body: body as Record<string, unknown>, statusCode: 200 }); })
          .catch(() => { server.close(); resolve({ body: {}, statusCode: 500 }); });
      });
    });

    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("uptime");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).not.toHaveProperty("hostname");
  });
});
