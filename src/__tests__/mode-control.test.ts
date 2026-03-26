import { describe, expect, it } from "vitest";
import { MODES, normalizeMode } from "../constants.ts";
import {
  isModeActive,
  shouldAutoUnmuteForMode,
  shouldStopForPersistedMode,
  shouldUsePushToTalkHold,
} from "../mode-control.ts";

describe("mode control", () => {
  it("treats only off as inactive", () => {
    expect(isModeActive(MODES.off)).toBe(false);
    expect(isModeActive(MODES.auto)).toBe(true);
    expect(isModeActive(MODES.autoOff)).toBe(true);
    expect(isModeActive(MODES.pushToTalk)).toBe(true);
  });

  it("isModeActive covers scheduling and shortcut use cases", () => {
    expect(isModeActive(MODES.off)).toBe(false);
    expect(isModeActive(MODES.auto)).toBe(true);
    expect(isModeActive(MODES.autoOff)).toBe(true);
    expect(isModeActive(MODES.pushToTalk)).toBe(true);
  });

  it("stops a running or starting session when persisted mode is off", () => {
    expect(
      shouldStopForPersistedMode({
        persistedMode: MODES.off,
        isListening: true,
        isStarting: false,
      }),
    ).toBe(true);
    expect(
      shouldStopForPersistedMode({
        persistedMode: MODES.off,
        isListening: false,
        isStarting: true,
      }),
    ).toBe(true);
  });

  it("does not stop when persisted mode is active", () => {
    expect(
      shouldStopForPersistedMode({
        persistedMode: MODES.autoOff,
        isListening: true,
        isStarting: false,
      }),
    ).toBe(false);
  });

  it("allows automatic unmute only in auto mode", () => {
    expect(shouldAutoUnmuteForMode(MODES.off)).toBe(false);
    expect(shouldAutoUnmuteForMode(MODES.auto)).toBe(true);
    expect(shouldAutoUnmuteForMode(MODES.autoOff)).toBe(false);
    expect(shouldAutoUnmuteForMode(MODES.pushToTalk)).toBe(false);
  });

  it("uses hold behavior only in push-to-talk", () => {
    expect(shouldUsePushToTalkHold(MODES.off)).toBe(false);
    expect(shouldUsePushToTalkHold(MODES.auto)).toBe(false);
    expect(shouldUsePushToTalkHold(MODES.autoOff)).toBe(false);
    expect(shouldUsePushToTalkHold(MODES.pushToTalk)).toBe(true);
  });

  it("normalizes unsupported persisted modes to auto", () => {
    expect(normalizeMode("smart")).toBe(MODES.auto);
    expect(normalizeMode("manual")).toBe(MODES.auto);
    expect(normalizeMode(undefined)).toBe(MODES.auto);
    expect(normalizeMode(MODES.autoOff)).toBe(MODES.autoOff);
  });
});
