// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePresence } from "../usePresence";

describe("usePresence", () => {
  afterEach(() => vi.useRealTimers());

  it("mounts at once and comes in", () => {
    const { result, rerender } = renderHook(({ visible }) => usePresence(visible, 300), {
      initialProps: { visible: false },
    });
    expect(result.current.mounted).toBe(false);
    rerender({ visible: true });
    expect(result.current).toMatchObject({ mounted: true, leaving: false, className: "vanish-in" });
  });

  it("stays mounted while it vanishes, then goes", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ visible }) => usePresence(visible, 300), {
      initialProps: { visible: true },
    });
    rerender({ visible: false });
    expect(result.current).toMatchObject({ mounted: true, leaving: true, className: "vanish-out" });
    act(() => vi.advanceTimersByTime(299));
    expect(result.current.mounted).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.mounted).toBe(false);
  });

  it("turns round when it is wanted back mid-exit", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ visible }) => usePresence(visible, 300), {
      initialProps: { visible: true },
    });
    rerender({ visible: false });
    act(() => vi.advanceTimersByTime(100));
    rerender({ visible: true });
    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toMatchObject({ mounted: true, leaving: false, className: "vanish-in" });
  });
});
