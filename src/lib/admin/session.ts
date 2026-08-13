import "server-only";

/** A signed, stateless session token: an expiry timestamp plus an HMAC over
 *  it, so a session can be verified without a database. Built on Web Crypto
 *  rather than Node's `crypto` module because this has to run in both the
 *  Edge middleware and the Node API routes, and Web Crypto is the one API
 *  both runtimes actually have. */

export const ADMIN_SESSION_COOKIE = "admin_session";

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

function secretKey(): Promise<CryptoKey> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Missing required environment variable: ADMIN_SESSION_SECRET");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export async function createSessionToken(): Promise<string> {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const key = await secretKey();
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(expiresAt)));
  return `${expiresAt}.${toHex(signature)}`;
}

export async function isValidSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [expiresAtRaw, signatureHex] = token.split(".");
  if (!expiresAtRaw || !signatureHex) return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const signatureBytes = fromHex(signatureHex);
  if (!signatureBytes) return false;

  const key = await secretKey();
  return crypto.subtle.verify("HMAC", key, signatureBytes, new TextEncoder().encode(expiresAtRaw));
}
