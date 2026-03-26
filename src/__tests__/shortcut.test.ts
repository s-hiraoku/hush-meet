import { describe, expect, it } from "vitest";
import { MODES, normalizeMode } from "../constants.ts";
import {
  matchesShortcut,
  parseShortcut,
  shouldHandleShortcutKeyDown,
  shouldHandleShortcutKeyUp,
} from "../shortcut.ts";

describe("shortcut utilities", () => {
  it("parses modifier shortcuts", () => {
    expect(parseShortcut("Ctrl+Shift+M")).toEqual({
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
      metaKey: false,
      key: "m",
    });
  });

  it("matches recorded cmd shortcut", () => {
    expect(
      matchesShortcut(
        {
          ctrlKey: false,
          shiftKey: true,
          altKey: false,
          metaKey: true,
          key: "X",
        },
        "Cmd+Shift+X",
      ),
    ).toBe(true);
  });

  it("ignores repeated keydown for toggle modes", () => {
    expect(
      shouldHandleShortcutKeyDown({
        enabled: true,
        event: {
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
          metaKey: false,
          key: "m",
          repeat: true,
        },
        mode: MODES.autoOff,
        pttKeyHeld: false,
        shortcut: "Ctrl+Shift+M",
      }),
    ).toBe(false);
  });

  it("handles first keydown for auto-off", () => {
    expect(
      shouldHandleShortcutKeyDown({
        enabled: true,
        event: {
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
          metaKey: false,
          key: "m",
          repeat: false,
        },
        mode: MODES.autoOff,
        pttKeyHeld: false,
        shortcut: "Ctrl+Shift+M",
      }),
    ).toBe(true);
  });

  it("handles shortcut in auto mode", () => {
    expect(
      shouldHandleShortcutKeyDown({
        enabled: true,
        event: {
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
          metaKey: false,
          key: "m",
          repeat: false,
        },
        mode: MODES.auto,
        pttKeyHeld: false,
        shortcut: "Ctrl+Shift+M",
      }),
    ).toBe(true);
  });

  it("handles a customized shortcut in auto-off mode", () => {
    expect(
      shouldHandleShortcutKeyDown({
        enabled: true,
        event: {
          ctrlKey: true,
          shiftKey: false,
          altKey: true,
          metaKey: false,
          key: "u",
          repeat: false,
        },
        mode: MODES.autoOff,
        pttKeyHeld: false,
        shortcut: "Ctrl+Alt+U",
      }),
    ).toBe(true);
  });

  it("requires held state for push-to-talk keyup", () => {
    expect(
      shouldHandleShortcutKeyUp({
        enabled: true,
        event: {
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
          metaKey: false,
          key: "m",
        },
        mode: MODES.pushToTalk,
        pttKeyHeld: false,
        shortcut: "Ctrl+Shift+M",
      }),
    ).toBe(false);
  });

  it("does not handle unrelated keyup in push-to-talk", () => {
    expect(
      shouldHandleShortcutKeyUp({
        enabled: true,
        event: {
          ctrlKey: true,
          shiftKey: false,
          altKey: false,
          metaKey: false,
          key: "x",
        },
        mode: MODES.pushToTalk,
        pttKeyHeld: true,
        shortcut: "Ctrl+Shift+M",
      }),
    ).toBe(false);
  });

  it("blocks repeated push-to-talk keydown while held", () => {
    expect(
      shouldHandleShortcutKeyDown({
        enabled: true,
        event: {
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
          metaKey: false,
          key: "m",
          repeat: false,
        },
        mode: MODES.pushToTalk,
        pttKeyHeld: true,
        shortcut: "Ctrl+Shift+M",
      }),
    ).toBe(false);
  });

  it("preserves saved supported modes during normalization", () => {
    expect(normalizeMode(MODES.off)).toBe(MODES.off);
    expect(normalizeMode(MODES.auto)).toBe(MODES.auto);
    expect(normalizeMode(MODES.autoOff)).toBe(MODES.autoOff);
    expect(normalizeMode(MODES.pushToTalk)).toBe(MODES.pushToTalk);
  });
});
