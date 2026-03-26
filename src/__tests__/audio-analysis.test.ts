import { describe, it, expect } from "vitest";
import {
  DEFAULT_CONFIG,
  MODES,
  SILENCE_RATIO,
  THRESHOLD_RANGE,
  normalizeMode,
} from "../constants.ts";
import type { ModeId } from "../constants.ts";
import { parseShortcut } from "../shortcut.ts";

/**
 * Tests for audio analysis logic extracted from content script.
 * These test the pure computation without browser/Chrome API dependencies.
 */

function computeRms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

function computeSpectrum(freqData: Uint8Array, bandCount: number): number[] {
  const bandSize = Math.max(1, Math.floor(freqData.length / bandCount));
  const spectrum: number[] = [];
  for (let b = 0; b < bandCount; b++) {
    let bandSum = 0;
    for (let i = b * bandSize; i < (b + 1) * bandSize && i < freqData.length; i++) {
      bandSum += freqData[i];
    }
    spectrum.push(bandSum / bandSize / 255);
  }
  return spectrum;
}

type StateType = "IDLE" | "MUTED" | "SPEAKING" | "GRACE" | "UNMUTING" | "ERROR";

function nextState(
  current: StateType,
  rms: number,
  speechThreshold: number,
  silenceThreshold: number,
  mode: ModeId = MODES.auto,
): StateType {
  if (mode === MODES.off) return current;
  switch (current) {
    case "MUTED":
      return rms > speechThreshold && mode === MODES.auto ? "UNMUTING" : "MUTED";
    case "SPEAKING":
      return rms < silenceThreshold ? "GRACE" : "SPEAKING";
    case "GRACE":
      return rms > silenceThreshold ? "SPEAKING" : "GRACE";
    default:
      return current;
  }
}

/**
 * Simulates manual mute detection logic.
 * Manual Meet mute/unmute changes state, but never changes mode.
 */
function detectManualMute(
  currentState: StateType,
  meetMuted: boolean,
  mutingByExtension: boolean,
  mode: ModeId,
): { state: StateType; mode: ModeId } {
  if (mutingByExtension) return { state: currentState, mode };
  if (currentState === "IDLE" || currentState === "ERROR") return { state: currentState, mode };
  if (mode === MODES.off) return { state: currentState, mode };

  if (meetMuted && currentState !== "MUTED") {
    return { state: "MUTED", mode };
  }
  if (!meetMuted && currentState === "MUTED") {
    return { state: "SPEAKING", mode };
  }
  return { state: currentState, mode };
}

/**
 * Builds getUserMedia audio constraints with optional deviceId.
 */
function buildAudioConstraints(deviceId: string | null): MediaTrackConstraints {
  const constraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: false,
    autoGainControl: true,
  };
  if (deviceId) {
    constraints.deviceId = { exact: deviceId };
  }
  return constraints;
}

describe("RMS computation", () => {
  it("returns 0 for silent audio", () => {
    const samples = new Float32Array(2048).fill(0);
    expect(computeRms(samples)).toBe(0);
  });

  it("returns correct RMS for known signal", () => {
    const samples = new Float32Array(1024).fill(0.5);
    expect(computeRms(samples)).toBeCloseTo(0.5);
  });

  it("returns correct RMS for sine-like signal", () => {
    const size = 1024;
    const samples = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      samples[i] = Math.sin((2 * Math.PI * i) / size);
    }
    expect(computeRms(samples)).toBeCloseTo(1 / Math.sqrt(2), 2);
  });

  it("handles single sample", () => {
    const samples = new Float32Array([0.3]);
    expect(computeRms(samples)).toBeCloseTo(0.3);
  });
});

describe("spectrum computation", () => {
  it("returns 16 bands", () => {
    const freqData = new Uint8Array(1024).fill(128);
    const spectrum = computeSpectrum(freqData, 16);
    expect(spectrum).toHaveLength(16);
  });

  it("returns normalized values between 0 and 1", () => {
    const freqData = new Uint8Array(1024);
    for (let i = 0; i < freqData.length; i++) {
      freqData[i] = Math.floor(Math.random() * 256);
    }
    const spectrum = computeSpectrum(freqData, 16);
    for (const val of spectrum) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });

  it("returns all zeros for silent spectrum", () => {
    const freqData = new Uint8Array(1024).fill(0);
    const spectrum = computeSpectrum(freqData, 16);
    for (const val of spectrum) {
      expect(val).toBe(0);
    }
  });

  it("returns all ~1.0 for max spectrum", () => {
    const freqData = new Uint8Array(1024).fill(255);
    const spectrum = computeSpectrum(freqData, 16);
    for (const val of spectrum) {
      expect(val).toBeCloseTo(1.0);
    }
  });

  it("handles small frequency data gracefully", () => {
    const freqData = new Uint8Array(8).fill(128);
    const spectrum = computeSpectrum(freqData, 16);
    expect(spectrum).toHaveLength(16);
  });
});

describe("state machine transitions", () => {
  const speech = DEFAULT_CONFIG.speechThreshold;
  const silence = speech * SILENCE_RATIO;

  it("MUTED → UNMUTING when RMS exceeds speech threshold", () => {
    expect(nextState("MUTED", speech + 0.01, speech, silence)).toBe("UNMUTING");
  });

  it("MUTED stays MUTED when RMS is below speech threshold", () => {
    expect(nextState("MUTED", speech - 0.01, speech, silence)).toBe("MUTED");
  });

  it("SPEAKING → GRACE when RMS drops below silence threshold", () => {
    expect(nextState("SPEAKING", silence - 0.001, speech, silence)).toBe("GRACE");
  });

  it("SPEAKING stays SPEAKING when RMS is above silence threshold", () => {
    expect(nextState("SPEAKING", silence + 0.01, speech, silence)).toBe("SPEAKING");
  });

  it("GRACE → SPEAKING when RMS exceeds silence threshold", () => {
    expect(nextState("GRACE", silence + 0.01, speech, silence)).toBe("SPEAKING");
  });

  it("GRACE stays GRACE when RMS is below silence threshold", () => {
    expect(nextState("GRACE", silence - 0.001, speech, silence)).toBe("GRACE");
  });

  it("IDLE does not transition regardless of RMS", () => {
    expect(nextState("IDLE", THRESHOLD_RANGE.max, speech, silence)).toBe("IDLE");
  });

  it("ERROR does not transition regardless of RMS", () => {
    expect(nextState("ERROR", THRESHOLD_RANGE.max, speech, silence)).toBe("ERROR");
  });

  it("silence threshold is always lower than speech threshold", () => {
    expect(silence).toBeLessThan(speech);
  });
});

describe("Off mode", () => {
  const speech = DEFAULT_CONFIG.speechThreshold;
  const silence = speech * SILENCE_RATIO;

  it("no transitions in Off mode regardless of RMS", () => {
    expect(nextState("MUTED", speech + 0.01, speech, silence, MODES.off)).toBe("MUTED");
    expect(nextState("SPEAKING", silence - 0.001, speech, silence, MODES.off)).toBe("SPEAKING");
    expect(nextState("IDLE", 1.0, speech, silence, MODES.off)).toBe("IDLE");
  });

  it("manual Meet unmute is ignored while Off", () => {
    const r = detectManualMute("MUTED", false, false, MODES.off);
    expect(r.state).toBe("MUTED");
    expect(r.mode).toBe(MODES.off);
  });
});

describe("manual mute detection", () => {
  it("user mute from SPEAKING transitions to MUTED without changing mode", () => {
    const r = detectManualMute("SPEAKING", true, false, MODES.auto);
    expect(r.state).toBe("MUTED");
    expect(r.mode).toBe(MODES.auto);
  });

  it("user mute from GRACE transitions to MUTED without changing mode", () => {
    const r = detectManualMute("GRACE", true, false, MODES.auto);
    expect(r.state).toBe("MUTED");
    expect(r.mode).toBe(MODES.auto);
  });

  it("ignores mute when mutingByExtension is true", () => {
    const r = detectManualMute("SPEAKING", true, true, MODES.auto);
    expect(r.state).toBe("SPEAKING");
    expect(r.mode).toBe(MODES.auto);
  });

  it("does not switch from MUTED (extension already muted)", () => {
    const r = detectManualMute("MUTED", true, false, MODES.auto);
    expect(r.mode).toBe(MODES.auto);
  });

  it("user unmute from MUTED transitions to SPEAKING", () => {
    const r = detectManualMute("MUTED", false, false, MODES.autoOff);
    expect(r.state).toBe("SPEAKING");
    expect(r.mode).toBe(MODES.autoOff);
  });

  it("Auto-Off keeps mode when user manually mutes from SPEAKING", () => {
    const r = detectManualMute("SPEAKING", true, false, MODES.autoOff);
    expect(r.state).toBe("MUTED");
    expect(r.mode).toBe(MODES.autoOff);
  });

  it("ignores changes in IDLE state", () => {
    const r = detectManualMute("IDLE", true, false, MODES.auto);
    expect(r.state).toBe("IDLE");
    expect(r.mode).toBe(MODES.auto);
  });

  it("ignores when already Off mode", () => {
    const r = detectManualMute("IDLE", true, false, MODES.off);
    expect(r.state).toBe("IDLE");
    expect(r.mode).toBe(MODES.off);
  });
});

describe("mode normalization", () => {
  it("maps unknown modes to auto", () => {
    expect(normalizeMode("smart")).toBe(MODES.auto);
    expect(normalizeMode("manual")).toBe(MODES.auto);
    expect(normalizeMode(undefined)).toBe(MODES.auto);
  });
});

describe("Auto-Off mode state transitions", () => {
  const speech = DEFAULT_CONFIG.speechThreshold;
  const silence = speech * SILENCE_RATIO;

  it("MUTED does NOT transition to UNMUTING when RMS exceeds threshold in auto-off mode", () => {
    expect(nextState("MUTED", speech + 0.01, speech, silence, MODES.autoOff)).toBe("MUTED");
  });

  it("MUTED still transitions to UNMUTING in auto mode", () => {
    expect(nextState("MUTED", speech + 0.01, speech, silence, MODES.auto)).toBe("UNMUTING");
  });

  it("MUTED stays MUTED even with very loud RMS in auto-off mode", () => {
    expect(nextState("MUTED", 1.0, speech, silence, MODES.autoOff)).toBe("MUTED");
  });

  it("user manual unmute from MUTED → SPEAKING in auto-off mode", () => {
    const r = detectManualMute("MUTED", false, false, MODES.autoOff);
    expect(r.state).toBe("SPEAKING");
  });

  it("SPEAKING → GRACE on silence works the same in auto-off mode", () => {
    expect(nextState("SPEAKING", silence - 0.001, speech, silence, MODES.autoOff)).toBe("GRACE");
  });

  it("GRACE → SPEAKING on speech works the same in auto-off mode", () => {
    expect(nextState("GRACE", silence + 0.01, speech, silence, MODES.autoOff)).toBe("SPEAKING");
  });

  it("GRACE stays GRACE on silence in auto-off mode", () => {
    expect(nextState("GRACE", silence - 0.001, speech, silence, MODES.autoOff)).toBe("GRACE");
  });

  it("does not auto-unmute again after auto-muting back to MUTED", () => {
    expect(nextState("MUTED", speech + 0.03, speech, silence, MODES.autoOff)).toBe("MUTED");
  });
});

describe("mic device selection constraints", () => {
  it("uses default constraints when no deviceId", () => {
    const c = buildAudioConstraints(null);
    expect(c.deviceId).toBeUndefined();
    expect(c.echoCancellation).toBe(true);
    expect(c.noiseSuppression).toBe(false);
    expect(c.autoGainControl).toBe(true);
  });

  it("uses empty string as no deviceId", () => {
    const c = buildAudioConstraints("");
    expect(c.deviceId).toBeUndefined();
  });

  it("adds exact deviceId when specified", () => {
    const c = buildAudioConstraints("abc123");
    expect(c.deviceId).toEqual({ exact: "abc123" });
  });

  it("preserves other constraints when deviceId is set", () => {
    const c = buildAudioConstraints("mic-1");
    expect(c.echoCancellation).toBe(true);
    expect(c.noiseSuppression).toBe(false);
    expect(c.autoGainControl).toBe(true);
  });
});

describe("Push-to-Talk mode", () => {
  const speech = DEFAULT_CONFIG.speechThreshold;
  const silence = speech * SILENCE_RATIO;

  it("MUTED does NOT auto-unmute on speech", () => {
    expect(nextState("MUTED", speech + 0.01, speech, silence, MODES.pushToTalk)).toBe("MUTED");
  });

  it("SPEAKING to GRACE on silence", () => {
    expect(nextState("SPEAKING", silence - 0.001, speech, silence, MODES.pushToTalk)).toBe("GRACE");
  });

  it("GRACE to SPEAKING on sound", () => {
    expect(nextState("GRACE", silence + 0.01, speech, silence, MODES.pushToTalk)).toBe("SPEAKING");
  });

  it("manual Meet unmute still tracks speaking state without changing mode", () => {
    const r = detectManualMute("MUTED", false, false, MODES.pushToTalk);
    expect(r.state).toBe("SPEAKING");
    expect(r.mode).toBe(MODES.pushToTalk);
  });
});

describe("shortcut key parsing", () => {
  it("Ctrl+Shift+M", () => {
    expect(parseShortcut("Ctrl+Shift+M")).toEqual({
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
      metaKey: false,
      key: "m",
    });
  });

  it("Alt+K", () => {
    expect(parseShortcut("Alt+K")).toEqual({
      ctrlKey: false,
      shiftKey: false,
      altKey: true,
      metaKey: false,
      key: "k",
    });
  });

  it("Cmd+Shift+X", () => {
    expect(parseShortcut("Cmd+Shift+X")).toEqual({
      ctrlKey: false,
      shiftKey: true,
      altKey: false,
      metaKey: true,
      key: "x",
    });
  });

  it("single key F1", () => {
    expect(parseShortcut("F1").key).toBe("f1");
  });
});
