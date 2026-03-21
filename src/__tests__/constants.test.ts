import { describe, it, expect } from "vitest";
import {
  DEFAULT_CONFIG,
  THRESHOLD_RANGE,
  GRACE_RANGE,
  SILENCE_RATIO,
  STORAGE_KEYS,
  APP_VERSION,
} from "../constants";

describe("constants", () => {
  it("default speechThreshold is within slider range", () => {
    expect(DEFAULT_CONFIG.speechThreshold).toBeGreaterThanOrEqual(THRESHOLD_RANGE.min);
    expect(DEFAULT_CONFIG.speechThreshold).toBeLessThanOrEqual(THRESHOLD_RANGE.max);
  });

  it("default silenceThreshold equals speechThreshold * SILENCE_RATIO", () => {
    expect(DEFAULT_CONFIG.silenceThreshold).toBeCloseTo(
      DEFAULT_CONFIG.speechThreshold * SILENCE_RATIO,
    );
  });

  it("default gracePeriod is within slider range", () => {
    expect(DEFAULT_CONFIG.gracePeriod).toBeGreaterThanOrEqual(GRACE_RANGE.min);
    expect(DEFAULT_CONFIG.gracePeriod).toBeLessThanOrEqual(GRACE_RANGE.max);
  });

  it("storage keys are unique", () => {
    const values = Object.values(STORAGE_KEYS);
    expect(new Set(values).size).toBe(values.length);
  });

  it("APP_VERSION matches semver format", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
