import { describe, expect, it } from "vitest";

import bot from "@/data/bot.json";
import { getBotKnowledge } from "@/lib/content/bot";
import { answer, keywords, normalise } from "../tars-brain";

const k = getBotKnowledge();
const ask = (question: string) => answer(question, k, bot);

describe("reading a question", () => {
  it("keeps the characters that belong to a technology's name", () => {
    expect(normalise("Does he know C++, C# and Node.js?")).toBe("does he know c++ c# and node.js");
  });

  it("drops filler and stems what is left", () => {
    expect(keywords("What projects has Saikiran built?")).toEqual(["project", "built"]);
  });
});

describe("TARS's answers", () => {
  it("greets, and says who it is", () => {
    expect(ask("hi").text).toBe(bot.greeting);
    expect(ask("hello there").text).toBe(bot.greeting);
    expect(ask("who are you?").text).toBe(bot.self);
  });

  it("answers about a project by its short name, from its own summary", () => {
    const certisafe = k.projects.find((p) => p.slug === "certisafe")!;
    const reply = ask("tell me about certisafe");
    expect(reply.text).toContain(certisafe.summary);
    expect(reply.links?.[0].href).toBe("/projects/certisafe");
  });

  it("answers about a company with every role there", () => {
    const reply = ask("What did he do at AarogyalinQ?");
    const roles = k.roles.filter((r) => r.company.startsWith("AarogyalinQ"));
    expect(roles.length).toBeGreaterThan(1);
    for (const role of roles) expect(reply.text).toContain(role.role);
  });

  it("names the skill and where it was used, with its page", () => {
    const reply = ask("Does he know React?");
    expect(reply.text).toMatch(/^React is in Saikiran's stack/);
    expect(reply.links?.[0].href).toBe("/skills/react");
  });

  it("quotes the FAQ in his words rather than retelling it", () => {
    const entry = k.faq.find((f) => f.id === "availability")!;
    const reply = ask("Is Saikiran looking for a job?");
    expect(reply.quote).toBe(entry.answer);
  });

  it("covers the everyday questions from the content files", () => {
    expect(ask("How can I contact him?").text).toContain(k.email);
    expect(ask("where is he based").text).toContain(k.location);
    expect(ask("Can I see his resume?").links?.map((l) => l.href)).toEqual(["/resume", "/cv"]);
    expect(ask("what college did he go to").text).toContain(k.education.institution);
    expect(ask("Where has Saikiran worked?").links?.length).toBe(k.roles.length);
    expect(ask("What has Saikiran built?").links?.at(-1)?.href).toBe("/projects");
    expect(ask("what's his tech stack").links?.[0].href).toBe("/skills");
  });

  it("introduces him from the résumé's headline and latest role", () => {
    const reply = ask("What does he do?");
    expect(reply.text).toContain(k.headline);
    expect(reply.text).toContain(k.roles[0].company);
  });

  it("finds an FAQ answer from one rare word, once nothing clearer matches", () => {
    expect(ask("Why no leetcode?").quote).toBe(k.faq.find((f) => f.id === "dsa-and-open-source")!.answer);
    expect(ask("is he a student").quote).toBe(k.faq.find((f) => f.id === "student-or-new-grad")!.answer);
  });

  it("answers for an area of the skill web", () => {
    const area = k.areas.find((a) => a.label === "Machine Learning")!;
    expect(ask("does he do machine learning").text).toContain(area.skills[0]);
  });

  it("quotes a role's summary, which is his own writing", () => {
    const reply = ask("what did he do at aude");
    expect(reply.quote).toBe(k.roles.find((r) => r.slug === "aude-ai")!.summary);
    expect(reply.text).not.toContain(reply.quote!);
  });

  it("says it does not know rather than guessing", () => {
    const reply = ask("What's his favourite film?");
    expect(reply.unknown).toBe(true);
    expect(reply.text).toBe(bot.unknown);
  });

  it("answers every suggested question it offers", () => {
    for (const suggestion of bot.suggestions) expect(ask(suggestion).unknown, suggestion).toBeFalsy();
  });

  it("never speaks as Saikiran outside a quote", () => {
    for (const question of ["what has he built", "where has he worked", "does he know docker", "contact", "tell me about third eye ai"]) {
      expect(ask(question).text, question).not.toMatch(/\b(I|my|me)\b/);
    }
  });
});
