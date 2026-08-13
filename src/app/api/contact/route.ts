import { NextResponse } from "next/server";

export const runtime = "nodejs";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;
const attempts = new Map<string, number[]>();

interface ContactPayload {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  source?: unknown;
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS);
  recent.push(now);
  attempts.set(ip, recent);
  return recent.length > MAX_REQUESTS;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many messages. Please try again in a few minutes." },
      { status: 429 },
    );
  }

  let payload: ContactPayload;
  try {
    payload = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const source = payload.source === "faq" ? "faq" : "contact";
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  const emailPattern = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

  // The contact form always sends a name; the FAQ question form only asks for
  // an email and a question, so a name is not expected there.
  if (
    (source === "contact" && (name.length < 1 || name.length > 100)) ||
    !emailPattern.test(email) ||
    email.length > 254 ||
    message.length < 1 ||
    message.length > 5000
  ) {
    return NextResponse.json({ error: "Please check your form details." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.CONTACT_EMAIL;
  const sender = process.env.RESEND_FROM_EMAIL ?? "Portfolio <onboarding@resend.dev>";

  if (!apiKey || !recipient) {
    console.error("Missing RESEND_API_KEY or CONTACT_EMAIL environment variable.");
    return NextResponse.json({ error: "Contact service is not configured." }, { status: 503 });
  }

  // Subject and body both carry the source, so a message can be told apart
  // from a question by looking at the mail alone.
  const subject =
    source === "faq" ? `Portfolio FAQ question from ${email}` : `Portfolio message from ${name}`;
  const text =
    source === "faq"
      ? `Source: FAQ page\nEmail: ${email}\n\n${message}`
      : `Source: Contact section\nName: ${name}\nEmail: ${email}\n\n${message}`;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: sender,
      to: [recipient],
      reply_to: email,
      subject,
      text,
    }),
  });

  if (!resendResponse.ok) {
    console.error("Resend request failed:", resendResponse.status, await resendResponse.text());
    return NextResponse.json(
      { error: "The message could not be sent. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
