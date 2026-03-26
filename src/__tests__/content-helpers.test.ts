import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MODES, SILENCE_RATIO, STORAGE_KEYS } from "../constants.ts";
import {
  persistErrorState,
  persistIdleSnapshot,
  persistMeters,
  persistState,
} from "../content/storage-sync.ts";
import { clearIntervalTimer, clearTimer } from "../content/timers.ts";
import {
  consumeShortcutEvent,
  shouldTriggerShortcutKeyDown,
  shouldTriggerShortcutKeyUp,
} from "../content/shortcut-controller.ts";
import {
  savePopupConfig,
  savePopupMicDevice,
  savePopupMode,
  savePopupShortcut,
} from "../popup/storage-actions.ts";

describe("content and popup helpers", () => {
  const storageSet = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          set: storageSet,
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
    savePopupConfig(0.03, 1200);
    savePopupMode(MODES.autoOff);
    savePopupShortcut("Ctrl+Alt+U");
    savePopupMicDevice("mic-1");
    expect(storageSet).toHaveBeenNthCalledWith(1, {
      [STORAGE_KEYS.config]: {
        speechThreshold: 0.03,
        silenceThreshold: 0.03 * SILENCE_RATIO,
        gracePeriod: 1200,
      },
    });
    expect(storageSet).toHaveBeenNthCalledWith(2, { [STORAGE_KEYS.mode]: MODES.autoOff });
    expect(storageSet).toHaveBeenNthCalledWith(3, { [STORAGE_KEYS.shortcutKey]: "Ctrl+Alt+U" });
    expect(storageSet).toHaveBeenNthCalledWith(4, { [STORAGE_KEYS.micDeviceId]: "mic-1" });
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
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    } as unknown as KeyboardEvent;
    consumeShortcutEvent(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(event.stopImmediatePropagation).toHaveBeenCalled();
  });

  it("consumes shortcut event without stopImmediatePropagation", () => {
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;
    consumeShortcutEvent(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it("delegates shortcut trigger policy", () => {
    expect(
      shouldTriggerShortcutKeyDown({
        isListening: true,
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
        isListening: true,
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
