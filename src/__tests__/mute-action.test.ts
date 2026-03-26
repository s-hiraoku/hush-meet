import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markExtensionMuteAction } from "../content/mute-action.ts";

describe("mute action helper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("runs action immediately and clears flag after 500ms", () => {
    const action = vi.fn();
    const clearFlag = vi.fn();

    markExtensionMuteAction(action, clearFlag);
    expect(action).toHaveBeenCalledTimes(1);
    expect(clearFlag).not.toHaveBeenCalled();

    vi.advanceTimersByTime(499);
    expect(clearFlag).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(clearFlag).toHaveBeenCalledTimes(1);
  });
});
