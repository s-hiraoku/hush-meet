import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, SILENCE_RATIO, THRESHOLD_RANGE } from "../constants.ts";

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

type StateType = "IDLE" | "MUTED" | "SPEAKING" | "GRACE" | "UNMUTING" | "USER_MUTED" | "ERROR";

function nextState(
  current: StateType,
  rms: number,
  speechThreshold: number,
  silenceThreshold: number,
): StateType {
  switch (current) {
    case "MUTED":
      return rms > speechThreshold ? "UNMUTING" : "MUTED";
    case "SPEAKING":
      return rms < silenceThreshold ? "GRACE" : "SPEAKING";
    case "GRACE":
      return rms > silenceThreshold ? "SPEAKING" : "GRACE";
    case "USER_MUTED":
      return "USER_MUTED"; // Never auto-transition out
    default:
      return current;
  }
}

/**
 * Simulates manual mute detection logic.
 * Returns new state when a mute button change is observed.
 */
function detectManualMute(
  currentState: StateType,
  meetMuted: boolean,
  mutingByExtension: boolean,
): StateType {
  if (mutingByExtension) return currentState;
  if (currentState === "IDLE" || currentState === "ERROR") return currentState;

  if (meetMuted && currentState !== "MUTED" && currentState !== "USER_MUTED") {
    return "USER_MUTED";
  }
  if (!meetMuted && currentState === "USER_MUTED") {
    return "SPEAKING";
  }
  return currentState;
}

/**
 * Simulates resume from USER_MUTED via popup button.
 */
function resumeAutoMute(currentState: StateType, requestedState: string): StateType {
  if (requestedState === "MUTED" && currentState === "USER_MUTED") {
    return "MUTED";
  }
  return currentState;
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

describe("USER_MUTED state", () => {
  const speech = DEFAULT_CONFIG.speechThreshold;
  const silence = speech * SILENCE_RATIO;

  it("USER_MUTED does not auto-transition even with loud RMS", () => {
    expect(nextState("USER_MUTED", 1.0, speech, silence)).toBe("USER_MUTED");
  });

  it("USER_MUTED does not transition on silence", () => {
    expect(nextState("USER_MUTED", 0, speech, silence)).toBe("USER_MUTED");
  });
});

describe("manual mute detection", () => {
  it("detects user mute from SPEAKING → USER_MUTED", () => {
    expect(detectManualMute("SPEAKING", true, false)).toBe("USER_MUTED");
  });

  it("detects user mute from GRACE → USER_MUTED", () => {
    expect(detectManualMute("GRACE", true, false)).toBe("USER_MUTED");
  });

  it("ignores mute when mutingByExtension is true", () => {
    expect(detectManualMute("SPEAKING", true, true)).toBe("SPEAKING");
  });

  it("does not re-enter USER_MUTED from MUTED", () => {
    expect(detectManualMute("MUTED", true, false)).toBe("MUTED");
  });

  it("does not re-enter USER_MUTED when already USER_MUTED", () => {
    expect(detectManualMute("USER_MUTED", true, false)).toBe("USER_MUTED");
  });

  it("user unmute from USER_MUTED → SPEAKING", () => {
    expect(detectManualMute("USER_MUTED", false, false)).toBe("SPEAKING");
  });

  it("ignores unmute when not in USER_MUTED state", () => {
    expect(detectManualMute("MUTED", false, false)).toBe("MUTED");
  });

  it("ignores changes in IDLE state", () => {
    expect(detectManualMute("IDLE", true, false)).toBe("IDLE");
    expect(detectManualMute("IDLE", false, false)).toBe("IDLE");
  });

  it("ignores changes in ERROR state", () => {
    expect(detectManualMute("ERROR", true, false)).toBe("ERROR");
    expect(detectManualMute("ERROR", false, false)).toBe("ERROR");
  });
});

describe("resume auto mute from popup", () => {
  it("USER_MUTED → MUTED when popup requests MUTED", () => {
    expect(resumeAutoMute("USER_MUTED", "MUTED")).toBe("MUTED");
  });

  it("does not change state if not in USER_MUTED", () => {
    expect(resumeAutoMute("SPEAKING", "MUTED")).toBe("SPEAKING");
    expect(resumeAutoMute("GRACE", "MUTED")).toBe("GRACE");
    expect(resumeAutoMute("IDLE", "MUTED")).toBe("IDLE");
  });

  it("does not change state for non-MUTED requests", () => {
    expect(resumeAutoMute("USER_MUTED", "SPEAKING")).toBe("USER_MUTED");
    expect(resumeAutoMute("USER_MUTED", "IDLE")).toBe("USER_MUTED");
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
