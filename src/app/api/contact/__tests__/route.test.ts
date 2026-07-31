import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "../route";

function makeRequest(body: unknown, ip: string, raw = false) {
  return new Request("http://localhost/api/contact", {
    method: "POST",
    headers: { "x-forwarded-for": ip, "content-type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

const validPayload = { name: "Ada Lovelace", email: "ada@example.com", message: "Hello there!" };

describe("POST /api/contact", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.RESEND_API_KEY = "test-key";
    process.env.CONTACT_EMAIL = "owner@example.com";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rejects invalid JSON bodies", async () => {
    const response = await POST(makeRequest("not-json", "1.1.1.1", true));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBeDefined();
  });

  it.each([
    { ...validPayload, name: "" },
    { ...validPayload, email: "not-an-email" },
    { ...validPayload, message: "" },
    { ...validPayload, name: "x".repeat(101) },
    { ...validPayload, message: "x".repeat(5001) },
  ])("rejects invalid form details %#", async (payload) => {
    const response = await POST(makeRequest(payload, "2.2.2.2"));
    expect(response.status).toBe(400);
  });

  it("returns 503 when Resend is not configured", async () => {
    delete process.env.RESEND_API_KEY;
    const response = await POST(makeRequest(validPayload, "3.3.3.3"));
    expect(response.status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends a formatted email through Resend and returns ok on success", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    const response = await POST(makeRequest(validPayload, "4.4.4.4"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      }),
    );
    const [, init] = vi.mocked(fetch).mock.calls[0];
    const sentBody = JSON.parse(init!.body as string);
    expect(sentBody.reply_to).toBe(validPayload.email);
    expect(sentBody.to).toEqual(["owner@example.com"]);
  });

  it("returns 502 when the Resend request fails", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("upstream error", { status: 500 }));
    const response = await POST(makeRequest(validPayload, "5.5.5.5"));
    expect(response.status).toBe(502);
  });

  it("rate limits after too many requests from the same IP within the window", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    const ip = "6.6.6.6";

    for (let i = 0; i < 5; i += 1) {
      const response = await POST(makeRequest(validPayload, ip));
      expect(response.status).toBe(200);
    }

    const limited = await POST(makeRequest(validPayload, ip));
    expect(limited.status).toBe(429);
  });

  it("does not rate limit a different IP address", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    for (let i = 0; i < 5; i += 1) {
      await POST(makeRequest(validPayload, "7.7.7.7"));
    }
    const response = await POST(makeRequest(validPayload, "8.8.8.8"));
    expect(response.status).toBe(200);
  });
});
