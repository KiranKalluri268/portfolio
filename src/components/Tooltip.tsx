"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { TOUCH_LABEL_MS } from "@/hooks/useHoverLabel";

/**
 * The site's one tooltip. Any element opts in with `data-tooltip="Label"`, and
 * this layer, mounted once in the root layout, shows the label for it:
 *
 * - beside the cursor while a mouse is over it, following the pointer;
 * - above the element when a finger taps it, gone again after TOUCH_LABEL_MS;
 * - above the element while it has keyboard focus, so a keyboard user is told
 *   the same thing a mouse user is.
 *
 * One layer rather than a tooltip per component. Each control used to carry its
 * own hover state and its own <Tooltip>, so each had its own copy of the touch
 * bug — a tap fires mouseenter with no mouseleave to follow — and fixing it in
 * one left it in the others. Here there is one set of listeners, delegated from
 * the document, and nothing to keep in step.
 *
 * The label is a visual echo of the element's accessible name, so it is
 * aria-hidden; the element keeps its own aria-label for screen readers. An empty
 * `data-tooltip` means none, and the label follows the attribute while it is up:
 * changed, it changes; removed or emptied, it goes.
 */

export const TOOLTIP_ATTRIBUTE = "data-tooltip";
const WITH_TOOLTIP = `[${TOOLTIP_ATTRIBUTE}]:not([${TOOLTIP_ATTRIBUTE}=""])`;

/** From the cursor, which it sits beside. */
const POINTER_GAP = 20;
/** From the element's edge, when it is anchored to the element itself. */
const ELEMENT_GAP = 10;
/** Kept clear of the screen's edges. */
const EDGE = 12;
/** After a tap, long enough for whatever it opened to be on screen. */
const COVER_CHECK_MS = 150;

/** What brought the label up: a mouse over the control, a finger tapping it,
 *  or keyboard focus. Each is put away by its own counterpart only. */
type Mode = "pointer" | "touch" | "focus";

export default function TooltipLayer() {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState({ text: "", visible: false, path: "" });
  const target = useRef<Element | null>(null);
  const mode = useRef<Mode>("pointer");
  const point = useRef({ x: 0, y: 0 });
  const pathname = usePathname();
  // A new page is a new set of controls: a label shown on the last one is not
  // carried over, even if the control it named is still on screen.
  const visible = label.visible && label.path === pathname;
  const labelRef = useRef(label);
  useEffect(() => {
    labelRef.current = label;
  }, [label]);

  const place = useCallback(() => {
    const tooltip = tooltipRef.current;
    const element = target.current;
    if (!tooltip || !element) return;
    const { offsetWidth, offsetHeight } = tooltip;
    let x: number;
    let y: number;
    if (mode.current === "pointer") {
      // Beside the cursor, flipping to its other side rather than running off
      // the screen.
      const { x: px, y: py } = point.current;
      x = px + POINTER_GAP + offsetWidth > window.innerWidth ? Math.max(0, px - POINTER_GAP - offsetWidth) : px + POINTER_GAP;
      y = py + POINTER_GAP + offsetHeight > window.innerHeight ? Math.max(0, py - POINTER_GAP - offsetHeight) : py + POINTER_GAP;
    } else {
      // Centred above the element, where a finger tapping it does not cover
      // it. Controls at the top of the screen have no room above, and clamping
      // there would put the label back on top of the control it names, so it
      // goes below instead.
      const box = element.getBoundingClientRect();
      x = Math.min(
        Math.max(EDGE, box.left + box.width / 2 - offsetWidth / 2),
        Math.max(EDGE, window.innerWidth - offsetWidth - EDGE),
      );
      const above = box.top - ELEMENT_GAP - offsetHeight;
      y = above >= EDGE ? above : box.bottom + ELEMENT_GAP;
    }
    tooltip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, []);

  useEffect(() => {
    let dismiss = 0;
    let covered = 0;
    const observer = new MutationObserver(() => {
      const text = target.current?.getAttribute(TOOLTIP_ATTRIBUTE);
      if (text) setLabel((current) => ({ ...current, text }));
      else hide();
    });

    function show(element: Element, as: Mode) {
      window.clearTimeout(dismiss);
      if (target.current !== element) {
        observer.disconnect();
        observer.observe(element, { attributes: true, attributeFilter: [TOOLTIP_ATTRIBUTE] });
      }
      target.current = element;
      mode.current = as;
      setLabel({ text: element.getAttribute(TOOLTIP_ATTRIBUTE) ?? "", visible: true, path: window.location.pathname });
    }

    function hide() {
      window.clearTimeout(dismiss);
      window.clearTimeout(covered);
      observer.disconnect();
      target.current = null;
      // The text stays while it fades out.
      setLabel((current) => (current.visible ? { ...current, visible: false } : current));
    }

    const labelled = (node: EventTarget | null) =>
      node instanceof Element ? node.closest(WITH_TOOLTIP) : null;

    // Only two numbers on every move across the page; the layout read in
    // place() happens only while a label is up and following the cursor.
    const onPointerMove = (event: PointerEvent) => {
      point.current = { x: event.clientX, y: event.clientY };
      if (!target.current || mode.current !== "pointer") return;
      if (!target.current.isConnected) hide();
      else place();
    };

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      point.current = { x: event.clientX, y: event.clientY };
      const element = labelled(event.target);
      if (element) {
        const stale = element !== target.current || mode.current !== "pointer";
        if (stale || labelRef.current.path !== window.location.pathname) show(element, "pointer");
      } else if (target.current && mode.current === "pointer") {
        hide();
      }
    };

    // Off the edge of the window there is no pointerover to say so.
    const onPointerOut = (event: PointerEvent) => {
      if (!event.relatedTarget && mode.current === "pointer") hide();
    };

    // A tap fires no pointerover worth trusting and no leave at all, so a
    // tapped label puts itself away.
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      const element = labelled(event.target);
      if (!element) {
        hide();
        return;
      }
      show(element, "touch");
      dismiss = window.setTimeout(hide, TOUCH_LABEL_MS);
      // A tap that opens something over its own control — the menu's panel
      // covering its button — leaves a label naming nothing on screen.
      covered = window.setTimeout(() => {
        if (target.current !== element) return;
        const box = element.getBoundingClientRect();
        const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        if (!top || !element.contains(top)) hide();
      }, COVER_CHECK_MS);
    };

    const onFocusIn = (event: FocusEvent) => {
      const element = event.target;
      if (!(element instanceof Element) || !element.matches(":focus-visible")) return;
      const labelledElement = labelled(element);
      if (labelledElement) show(labelledElement, "focus");
    };

    // Only the focus that brought it up. Tapping one control moves focus off
    // the last one, and that must not take the new tap's label down with it.
    const onFocusOut = (event: FocusEvent) => {
      if (mode.current === "focus" && event.target instanceof Element && labelled(event.target) === target.current) hide();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };

    // Anchored to an element, the label moves with it.
    const onScroll = () => {
      if (target.current && mode.current !== "pointer") place();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerover", onPointerOver, { passive: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true });
    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      window.clearTimeout(dismiss);
      window.clearTimeout(covered);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [place]);

  // Placed before the paint that shows it, and again whenever its text changes
  // width, so it is never seen in the corner on its way to the right spot.
  useLayoutEffect(() => {
    if (visible) place();
  }, [visible, label.text, place]);

  return (
    <div
      ref={tooltipRef}
      aria-hidden="true"
      style={{ left: 0, top: 0, zIndex: 9999 }}
      className={`fixed pointer-events-none whitespace-nowrap text-white text-sm font-semibold tracking-wide bg-black/40 px-2 py-1 rounded-md backdrop-blur-md border border-white/10 transition-[opacity,transform] duration-150 ${visible ? "opacity-100 scale-100" : "opacity-0 scale-80"}`}
    >
      {label.text}
    </div>
  );
}
