import { beforeEach, describe, expect, it } from "vitest";
import { createSessionToken, isValidSessionToken } from "../session";

describe("admin session tokens", () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = "test-secret-do-not-use-in-real-config";
  });

  it("accepts a token it just issued", async () => {
    const token = await createSessionToken();
    expect(await isValidSessionToken(token)).toBe(true);
  });

  it("rejects a missing token", async () => {
    expect(await isValidSessionToken(undefined)).toBe(false);
    expect(await isValidSessionToken(null)).toBe(false);
    expect(await isValidSessionToken("")).toBe(false);
  });

  it("rejects a token with a tampered expiry", async () => {
    const token = await createSessionToken();
    const [, signature] = token.split(".");
    const forged = `${Date.now() + 1_000_000_000}.${signature}`;
    expect(await isValidSessionToken(forged)).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken();
    process.env.ADMIN_SESSION_SECRET = "a-completely-different-secret";
    expect(await isValidSessionToken(token)).toBe(false);
  });

  it("rejects malformed tokens", async () => {
    expect(await isValidSessionToken("not-a-real-token")).toBe(false);
    expect(await isValidSessionToken("123456")).toBe(false);
    expect(await isValidSessionToken("123.not-hex-!!!!")).toBe(false);
  });

  it("rejects an expired token", async () => {
    // Signed for a timestamp already in the past, rather than waiting out
    // the real session duration.
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const expiredAt = String(Date.now() - 1000);
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(expiredAt));
    const hex = Array.from(new Uint8Array(signature))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    expect(await isValidSessionToken(`${expiredAt}.${hex}`)).toBe(false);
  });
});
