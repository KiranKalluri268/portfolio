// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import lines from "@/data/bot.json";
import { getBotKnowledge } from "@/lib/content/bot";
import { HintProvider, usePublishHint } from "@/components/hints/HintContext";
import Tars from "../Tars";

let pathname = "/skills";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/context/AudioContextProvider", () => ({ useAudio: () => ({ hasEntered: false }) }));

const knowledge = getBotKnowledge();

function Scene({ hint }: { hint: string | null }) {
  usePublishHint("scene", hint);
  return null;
}

describe("TARS", () => {
  beforeEach(() => {
    pathname = "/skills";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/tars" ? new Response(JSON.stringify(knowledge)) : new Response("{}", { status: 200 }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("says the scene's hint, and takes it back when the scene withdraws it", async () => {
    const { rerender } = render(
      <HintProvider>
        <Scene hint="Drag to explore" />
        <Tars />
      </HintProvider>,
    );
    expect(screen.getByText("Drag to explore")).toBeInTheDocument();
    rerender(
      <HintProvider>
        <Scene hint={null} />
        <Tars />
      </HintProvider>,
    );
    // It goes back into TARS rather than blinking out.
    expect(screen.getByText("Drag to explore").className).toMatch(/tipOut/);
    await waitFor(() => expect(screen.queryByText("Drag to explore")).not.toBeInTheDocument());
  });

  it("opens its slabs while it speaks, and wider while the chat is out", async () => {
    const user = userEvent.setup();
    render(
      <HintProvider>
        <Scene hint="Drag to explore" />
        <Tars />
      </HintProvider>,
    );
    const pose = () => screen.getByRole("button", { name: /TARS/ }).querySelector("svg")!.getAttribute("data-pose");
    expect(pose()).toBe("speaking");
    await user.click(screen.getByRole("button", { name: /Ask TARS/ }));
    expect(pose()).toBe("open");
  });

  it("waits for the loading screen on the home page, and stays off the admin pages", () => {
    pathname = "/";
    const { rerender } = render(<Tars />);
    expect(screen.queryByRole("button", { name: /Ask TARS/ })).not.toBeInTheDocument();
    pathname = "/admin";
    rerender(<Tars />);
    expect(screen.queryByRole("button", { name: /Ask TARS/ })).not.toBeInTheDocument();
  });

  it("answers a suggested question from what it fetched", async () => {
    const user = userEvent.setup();
    render(<Tars />);
    await user.click(screen.getByRole("button", { name: /Ask TARS/ }));
    expect(screen.getByRole("dialog", { name: "TARS" })).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/tars"));
    await user.click(screen.getByRole("button", { name: lines.suggestions[0] }));
    expect(await screen.findByRole("link", { name: "All projects" })).toHaveAttribute("href", "/projects");
  });

  it("offers to pass on what it cannot answer, and sends it with the visitor's email", async () => {
    const user = userEvent.setup();
    render(<Tars />);
    await user.click(screen.getByRole("button", { name: /Ask TARS/ }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/tars"));
    await act(async () => {});

    await user.type(screen.getByLabelText("Your question"), "What's his favourite film?{Enter}");
    expect(await screen.findByText(lines.unknown)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Yes, pass it on" }));
    expect(screen.getByText(lines.askEmail)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Your email address"), "not-an-email{Enter}");
    expect(screen.getByText(lines.badEmail)).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Your email address"));
    await user.type(screen.getByLabelText("Your email address"), "asker@example.com{Enter}");
    expect(await screen.findByText(lines.sent)).toBeInTheDocument();
    const [, init] = vi.mocked(fetch).mock.calls.find(([url]) => url === "/api/contact")!;
    expect(JSON.parse(init!.body as string)).toEqual({
      email: "asker@example.com",
      message: "What's his favourite film?",
      source: "tars",
    });
  });

  it("closes on Escape and hands focus back to the orb", async () => {
    const user = userEvent.setup();
    render(<Tars />);
    const orb = screen.getByRole("button", { name: /Ask TARS/ });
    await user.click(orb);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Ask TARS/ }));
  });
});
