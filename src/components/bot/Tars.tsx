"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import lines from "@/data/bot.json";
import { useAudio } from "@/context/AudioContextProvider";
import { useCurrentHint } from "@/components/hints/HintContext";
import { usePresence } from "@/hooks/usePresence";
import { answer, type BotKnowledge, type BotLink, type BotReply } from "./tars-brain";
import styles from "./tars.module.css";

/**
 * TARS, the site's guide: a small black hole in the bottom-left corner.
 *
 * It says the scene hints — "Scroll down to take a look around" — in a bubble
 * beside it, and opens a chat when pressed. Its answers come from tars-brain,
 * which only fills templates from the content files; what it cannot answer it
 * offers to pass on to Saikiran by email, through the contact endpoint.
 *
 * What it knows is fetched from /api/tars the first time the chat opens, so
 * nothing about it is in any page's HTML.
 */

interface Message {
  id: number;
  from: "tars" | "visitor";
  reply: BotReply;
}

/** What the chat is waiting for after TARS has had to say "not on file". */
type Pending =
  | { kind: "none" }
  | { kind: "offer"; question: string }
  | { kind: "email"; question: string }
  | { kind: "sending" };

const HIDDEN_ON = [/^\/admin/, /^\/cinematic/];
const EMAIL = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export default function Tars() {
  const pathname = usePathname();
  const { hasEntered } = useAudio();
  const hint = useCurrentHint();
  const [open, setOpen] = useState(false);
  const [knowledge, setKnowledge] = useState<BotKnowledge | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => [
    { id: 0, from: "tars", reply: { text: lines.greeting } },
  ]);
  const [pending, setPending] = useState<Pending>({ kind: "none" });
  const [draft, setDraft] = useState("");
  const nextId = useRef(1);
  const orbRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // On the home page nobody is here until the loading screen has handed over.
  const shown = !HIDDEN_ON.some((pattern) => pattern.test(pathname)) && (pathname !== "/" || hasEntered);
  const tipText = shown && !open ? hint : null;
  // The last line said, kept while the bubble vanishes so it leaves with its
  // own words rather than blanking first.
  const [lastTip, setLastTip] = useState<string | null>(null);
  if (tipText && tipText !== lastTip) setLastTip(tipText);
  const tip = usePresence(Boolean(tipText));
  const panel = usePresence(open && shown);

  // Fetched once, the first time it is wanted.
  useEffect(() => {
    if (!open || knowledge || loadFailed) return;
    let cancelled = false;
    fetch("/api/tars")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data: BotKnowledge) => {
        if (!cancelled) setKnowledge(data);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, knowledge, loadFailed]);

  const say = useCallback((from: Message["from"], reply: BotReply) => {
    setMessages((previous) => [...previous, { id: nextId.current++, from, reply }]);
  }, []);

  // The newest message in view, and the input ready to type into.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, pending]);

  useEffect(() => {
    if (panel.mounted && !panel.leaving) inputRef.current?.focus();
  }, [panel.mounted, panel.leaving, pending.kind]);

  const close = useCallback(() => {
    setOpen(false);
    orbRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  // A new page: the conversation stays, but the panel is put away so it is
  // not sitting over the page the visitor just asked for.
  const [openedOn, setOpenedOn] = useState(pathname);
  if (openedOn !== pathname) {
    setOpenedOn(pathname);
    if (open) setOpen(false);
  }

  const ask = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    say("visitor", { text: trimmed });
    setDraft("");
    if (!knowledge) {
      say("tars", { text: loadFailed ? lines.sendFailed : lines.loading });
      return;
    }
    const reply = answer(trimmed, knowledge, lines);
    say("tars", reply);
    setPending(reply.unknown ? { kind: "offer", question: trimmed } : { kind: "none" });
  };

  const accept = () => {
    if (pending.kind !== "offer") return;
    say("visitor", { text: "Yes, pass it on" });
    say("tars", { text: lines.askEmail });
    setPending({ kind: "email", question: pending.question });
  };

  const decline = () => {
    say("visitor", { text: "No thanks" });
    say("tars", { text: lines.declined });
    setPending({ kind: "none" });
  };

  const send = async (email: string, question: string) => {
    say("visitor", { text: email });
    setDraft("");
    setPending({ kind: "sending" });
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, message: question, source: "tars" }),
      });
      if (!response.ok) throw new Error(String(response.status));
      say("tars", { text: lines.sent });
      setPending({ kind: "none" });
    } catch {
      say("tars", { text: lines.sendFailed });
      setPending({ kind: "email", question });
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending.kind === "email") {
      const email = draft.trim();
      if (!EMAIL.test(email)) {
        say("tars", { text: lines.badEmail });
        return;
      }
      void send(email, pending.question);
      return;
    }
    if (pending.kind === "sending") return;
    ask(draft);
  };

  if (!shown) return null;

  const showSuggestions = messages.length === 1 && pending.kind === "none";

  return (
    <div className={styles.dock}>
      {tip.mounted && lastTip && (
        <div className={`${styles.tip} ${tip.className}`} data-tars-tip aria-hidden="true">
          {lastTip}
        </div>
      )}

      {panel.mounted && (
        <section
          className={`${styles.panel} ${panel.className}`}
          role="dialog"
          aria-labelledby={titleId}
        >
          <header className={styles.header}>
            <span className={styles.orb} aria-hidden="true" style={{ width: 30, height: 30, cursor: "default" }}>
              <span className={styles.disk} />
              <span className={styles.core} />
            </span>
            <div>
              <h2 id={titleId} className={styles.title}>{lines.name}</h2>
              <p className={styles.subtitle}>{lines.subtitle}</p>
            </div>
            <button type="button" className={styles.close} onClick={close} aria-label="Close chat" data-tooltip="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          <div ref={logRef} className={styles.log} aria-live="polite">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`${styles.bubble} ${message.from === "tars" ? styles.fromTars : styles.fromVisitor}`}
              >
                <p>{message.reply.text}</p>
                {message.reply.quote && <blockquote className={styles.quote}>{message.reply.quote}</blockquote>}
                {message.reply.links && message.reply.links.length > 0 && (
                  <div className={styles.chips}>
                    {message.reply.links.map((link) => (
                      <ReplyLink key={`${link.href}-${link.label}`} link={link} />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {showSuggestions && (
              <div className={styles.chips}>
                {lines.suggestions.map((suggestion) => (
                  <button key={suggestion} type="button" className={styles.chip} onClick={() => ask(suggestion)}>
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {pending.kind === "offer" && (
              <div className={styles.chips}>
                <button type="button" className={styles.chip} onClick={accept}>Yes, pass it on</button>
                <button type="button" className={styles.chip} onClick={decline}>No thanks</button>
              </div>
            )}
          </div>

          <form className={styles.form} onSubmit={submit} noValidate>
            <input
              ref={inputRef}
              className={styles.input}
              type={pending.kind === "email" ? "email" : "text"}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={pending.kind === "email" ? "you@example.com" : lines.placeholder}
              aria-label={pending.kind === "email" ? "Your email address" : "Your question"}
              autoComplete={pending.kind === "email" ? "email" : "off"}
              maxLength={pending.kind === "email" ? 254 : 500}
              disabled={pending.kind === "sending"}
            />
            <button type="submit" className={styles.send} disabled={!draft.trim() || pending.kind === "sending"}>
              {pending.kind === "sending" ? "Sending…" : "Send"}
            </button>
          </form>
        </section>
      )}

      <button
        ref={orbRef}
        type="button"
        className={`${styles.orb} ${tipText ? styles.speaking : ""}`}
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={open ? "Close TARS, the site guide" : "Ask TARS, the site guide"}
        aria-expanded={open}
        data-tooltip={open ? "" : "Ask TARS"}
      >
        <span className={styles.disk} aria-hidden="true" />
        <span className={styles.core} aria-hidden="true" />
      </button>
    </div>
  );
}

function ReplyLink({ link }: { link: BotLink }) {
  const external = /^(https?:|mailto:)/.test(link.href);
  if (external) {
    return (
      <a
        className={styles.chip}
        href={link.href}
        target={link.href.startsWith("mailto:") ? undefined : "_blank"}
        rel={link.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
      >
        {link.label}
        {!link.href.startsWith("mailto:") && <span aria-hidden="true"> ↗</span>}
      </a>
    );
  }
  return (
    <Link className={styles.chip} href={link.href}>
      {link.label}
    </Link>
  );
}
