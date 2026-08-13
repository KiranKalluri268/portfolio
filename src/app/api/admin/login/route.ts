import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, createSessionToken } from "@/lib/admin/session";

/** Hashed to a fixed length before comparing, so timingSafeEqual (which
 *  requires equal-length buffers) never throws on a wrong-length guess, and
 *  so the comparison doesn't leak the real password's length either. */
function passwordsMatch(submitted: string, expected: string): boolean {
  const submittedHash = createHash("sha256").update(submitted).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(submittedHash, expectedHash);
}

export async function POST(request: Request) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json({ error: "Admin login is not configured" }, { status: 503 });
  }

  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  if (typeof password !== "string" || !passwordsMatch(password, adminPassword)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = await createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
