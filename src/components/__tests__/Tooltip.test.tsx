// @vitest-environment jsdom
import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import TooltipLayer from "../Tooltip";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

/** jsdom has no PointerEvent, so these carry pointerType themselves. */
function pointer(type: string, target: Element, pointerType = "mouse", relatedTarget: Element | null = null) {
  const event = new MouseEvent(type, { bubbles: true, clientX: 10, clientY: 10, relatedTarget });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  fireEvent(target, event);
}

function setup(attributes: Record<string, string> = { "data-tooltip": "Zoom in" }) {
  const { container } = render(
    <>
      <button type="button" {...attributes}>
        <span>+</span>
      </button>
      <p>Elsewhere</p>
      <TooltipLayer />
    </>,
  );
  const button = container.querySelector("button")!;
  const elsewhere = container.querySelector("p")!;
  const label = container.querySelector("[aria-hidden='true']")!;
  const shown = () => label.className.includes("opacity-100");
  return { button, elsewhere, label, shown };
}

describe("TooltipLayer", () => {
  afterEach(() => vi.useRealTimers());

  it("labels whatever the mouse is over, from a child of the control too", () => {
    vi.useFakeTimers();
    const { button, elsewhere, label, shown } = setup();
    expect(shown()).toBe(false);
    pointer("pointerover", button.querySelector("span")!);
    expect(shown()).toBe(true);
    expect(label.textContent).toBe("Zoom in");
    pointer("pointerover", elsewhere);
    act(() => vi.advanceTimersByTime(150));
    expect(shown()).toBe(false);
  });

  it("swaps straight to the next control when the cursor crosses a gap to it", () => {
    vi.useFakeTimers();
    const { container } = render(
      <>
        <button type="button" data-tooltip="Hero" />
        <span>gap</span>
        <button type="button" data-tooltip="About" />
        <TooltipLayer />
      </>,
    );
    const [first, second] = container.querySelectorAll("button");
    const gap = container.querySelector("span")!;
    const label = container.querySelector("[aria-hidden='true']")!;
    const shown = () => label.className.includes("opacity-100");

    pointer("pointerover", first);
    pointer("pointerover", gap);
    act(() => vi.advanceTimersByTime(60));
    // Still up while crossing the gap, so it never fades out and back in.
    expect(shown()).toBe(true);
    pointer("pointerover", second);
    expect(shown()).toBe(true);
    expect(label.textContent).toBe("About");
    act(() => vi.advanceTimersByTime(500));
    expect(shown()).toBe(true);
  });

  it("never animates its position, only its fade", () => {
    const { label } = setup();
    expect(label.className).toMatch(/transition-\[opacity,scale\]/);
    expect(label.className).not.toMatch(/transform/);
  });

  it("goes when the pointer leaves the window", () => {
    const { button, shown } = setup();
    pointer("pointerover", button);
    pointer("pointerout", button, "mouse", null);
    expect(shown()).toBe(false);
  });

  it("follows the attribute while it is up", async () => {
    const { button, label, shown } = setup();
    pointer("pointerover", button);
    await act(async () => button.setAttribute("data-tooltip", "Zoom out"));
    expect(label.textContent).toBe("Zoom out");
    await act(async () => button.setAttribute("data-tooltip", ""));
    expect(shown()).toBe(false);
  });

  it("treats an empty attribute as no label", () => {
    const { button, shown } = setup({ "data-tooltip": "" });
    pointer("pointerover", button);
    expect(shown()).toBe(false);
  });

  it("ignores touch hovering, but shows a tapped label and then puts it away", () => {
    vi.useFakeTimers();
    const { button, shown } = setup();
    // jsdom has no hit testing; the control is what is under the finger.
    document.elementFromPoint = () => button;
    pointer("pointerover", button, "touch");
    expect(shown()).toBe(false);
    pointer("pointerdown", button, "touch");
    expect(shown()).toBe(true);
    act(() => vi.advanceTimersByTime(1000));
    expect(shown()).toBe(true);
    act(() => vi.advanceTimersByTime(1000));
    expect(shown()).toBe(false);
  });

  it("puts a tapped label away once what the tap opened covers its control", () => {
    vi.useFakeTimers();
    const { button, elsewhere, shown } = setup();
    document.elementFromPoint = () => elsewhere;
    pointer("pointerdown", button, "touch");
    expect(shown()).toBe(true);
    act(() => vi.advanceTimersByTime(200));
    expect(shown()).toBe(false);
  });

  it("is dismissed with Escape", () => {
    const { button, shown } = setup();
    pointer("pointerover", button);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(shown()).toBe(false);
  });
});
