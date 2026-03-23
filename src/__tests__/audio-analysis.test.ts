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

type StateType = "IDLE" | "MUTED" | "SPEAKING" | "GRACE" | "UNMUTING";

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
    default:
      return current;
  }
}

describe("RMS computation", () => {
  it("returns 0 for silent audio", () => {
    const samples = new Float32Array(2048).fill(0);
    expect(computeRms(samples)).toBe(0);
  });

  it("returns correct RMS for known signal", () => {
    // A constant signal of 0.5 has RMS = 0.5
    const samples = new Float32Array(1024).fill(0.5);
    expect(computeRms(samples)).toBeCloseTo(0.5);
  });

  it("returns correct RMS for sine-like signal", () => {
    const size = 1024;
    const samples = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      samples[i] = Math.sin((2 * Math.PI * i) / size);
    }
    // RMS of a sine wave = 1/sqrt(2) ≈ 0.707
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
    // bandSize = max(1, floor(8/16)) = 1
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

  it("silence threshold is always lower than speech threshold", () => {
    expect(silence).toBeLessThan(speech);
  });
});
