import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markExtensionMuteAction } from "../content/mute-action.ts";

describe("mute action helper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb: FrameRequestCallback) => {
        setTimeout(() => cb(0), 0);
        return 0;
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("runs action immediately and clears flag after rAF + buffer", () => {
    const action = vi.fn();
    const clearFlag = vi.fn();

    markExtensionMuteAction(action, clearFlag);
    expect(action).toHaveBeenCalledTimes(1);
    expect(clearFlag).not.toHaveBeenCalled();

    // rAF fires (simulated as setTimeout 0) + 120ms buffer
    vi.advanceTimersByTime(0); // rAF callback
    expect(clearFlag).not.toHaveBeenCalled();

    vi.advanceTimersByTime(120);
    expect(clearFlag).toHaveBeenCalledTimes(1);
  });

  it("clears flag via fallback timeout if rAF is delayed", () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn()); // rAF that never calls back

    const action = vi.fn();
    const clearFlag = vi.fn();

    markExtensionMuteAction(action, clearFlag);
    expect(clearFlag).not.toHaveBeenCalled();

    vi.advanceTimersByTime(599);
    expect(clearFlag).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(clearFlag).toHaveBeenCalledTimes(1);
  });
});
