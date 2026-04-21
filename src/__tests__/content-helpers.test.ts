import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MODES, STORAGE_KEYS } from "../constants.ts";
import {
  persistErrorState,
  persistIdleSnapshot,
  persistMeters,
  persistState,
} from "../content/storage-sync.ts";
import { clearIntervalTimer, clearTimer } from "../content/timers.ts";
import {
  consumeShortcutEvent,
  getModeSwitchShortcutTarget,
  shouldTriggerShortcutKeyDown,
  shouldTriggerShortcutKeyUp,
} from "../content/shortcut-controller.ts";
import {
  savePopupConfig,
  savePopupMicDevice,
  savePopupMicToggle,
  savePopupMode,
  savePopupShortcut,
} from "../popup/storage-actions.ts";

describe("content and popup helpers", () => {
  const storageSet = vi.fn();
  const storageGet = vi.fn((_keys: string[], cb: (result: Record<string, unknown>) => void) => {
    cb({});
  });

  beforeEach(() => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          set: storageSet,
          get: storageGet,
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    storageSet.mockReset();
  });

  it("persists state and meters", () => {
    persistState("MUTED");
    persistMeters(0.25, [0.1, 0.2]);
    expect(storageSet).toHaveBeenNthCalledWith(1, { [STORAGE_KEYS.state]: "MUTED" });
    expect(storageSet).toHaveBeenNthCalledWith(2, {
      [STORAGE_KEYS.level]: 0.25,
      [STORAGE_KEYS.spectrum]: [0.1, 0.2],
    });
  });

  it("persists idle and error snapshots", () => {
    persistIdleSnapshot();
    persistErrorState("mic_not_found");
    expect(storageSet).toHaveBeenNthCalledWith(1, {
      [STORAGE_KEYS.state]: "IDLE",
      [STORAGE_KEYS.level]: 0,
      [STORAGE_KEYS.spectrum]: [],
    });
    expect(storageSet).toHaveBeenNthCalledWith(2, {
      [STORAGE_KEYS.state]: "ERROR",
      [STORAGE_KEYS.error]: "mic_not_found",
    });
  });

  it("persists popup settings", () => {
    savePopupConfig(MODES.auto, 0.03, 1200);
    savePopupMode(MODES.autoOff);
    savePopupShortcut("Ctrl+Alt+U");
    savePopupMicDevice("mic-1");
    // savePopupConfig does get then set (async via callback), so set is called by the get mock
    expect(storageSet).toHaveBeenCalledWith(
      expect.objectContaining({ [STORAGE_KEYS.config]: expect.any(Object) }),
    );
    expect(storageSet).toHaveBeenCalledWith({ [STORAGE_KEYS.mode]: MODES.autoOff });
    expect(storageSet).toHaveBeenCalledWith({ [STORAGE_KEYS.shortcutKey]: "Ctrl+Alt+U" });
    expect(storageSet).toHaveBeenCalledWith({ [STORAGE_KEYS.micDeviceId]: "mic-1" });
  });

  it("sends mic toggle requests with unique timestamps", () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1001);

    savePopupMicToggle("toggle");
    savePopupMicToggle("toggle");

    expect(storageSet).toHaveBeenNthCalledWith(1, {
      [STORAGE_KEYS.micToggleAction]: { action: "toggle", requestedAt: 1000 },
    });
    expect(storageSet).toHaveBeenNthCalledWith(2, {
      [STORAGE_KEYS.micToggleAction]: { action: "toggle", requestedAt: 1001 },
    });
  });

  it("clears timers and intervals", () => {
    const timeoutId = setTimeout(() => {}, 1000);
    const intervalId = setInterval(() => {}, 1000);
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    expect(clearTimer(timeoutId)).toBeNull();
    expect(clearIntervalTimer(intervalId)).toBeNull();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("returns null unchanged when clearing missing timers", () => {
    expect(clearTimer(null)).toBeNull();
    expect(clearIntervalTimer(null)).toBeNull();
  });

  it("consumes shortcut event", () => {
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    const stopImmediatePropagation = vi.fn();
    const event = {
      preventDefault,
      stopPropagation,
      stopImmediatePropagation,
    } as unknown as KeyboardEvent;
    consumeShortcutEvent(event);
    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    expect(stopImmediatePropagation).toHaveBeenCalled();
  });

  it("consumes shortcut event without stopImmediatePropagation", () => {
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    const event = {
      preventDefault,
      stopPropagation,
    } as unknown as KeyboardEvent;
    consumeShortcutEvent(event);
    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
  });

  it("delegates shortcut trigger policy", () => {
    expect(
      getModeSwitchShortcutTarget({
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
        key: "@",
        code: "Digit2",
        repeat: false,
      } as KeyboardEvent),
    ).toBe(MODES.autoOff);

    expect(
      getModeSwitchShortcutTarget({
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
        key: "@",
        code: "Digit2",
        repeat: true,
      } as KeyboardEvent),
    ).toBeNull();

    expect(
      shouldTriggerShortcutKeyDown({
        mode: MODES.autoOff,
        pttKeyHeld: false,
        shortcut: "Ctrl+Shift+M",
        event: {
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
          metaKey: false,
          key: "m",
          repeat: false,
        } as KeyboardEvent,
      }),
    ).toBe(true);

    expect(
      shouldTriggerShortcutKeyUp({
        mode: MODES.pushToTalk,
        pttKeyHeld: true,
        shortcut: "Ctrl+Shift+M",
        event: {
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
          metaKey: false,
          key: "m",
        } as KeyboardEvent,
      }),
    ).toBe(true);
  });
});
