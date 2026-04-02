import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, MODES, SILENCE_RATIO } from "../constants.ts";
import {
  buildAudioConstraints,
  DEFAULT_PER_MODE_CONFIG,
  getConfigForMode,
  migrateConfig,
  normalizeConfig,
  setConfigForMode,
} from "../content/config.ts";

describe("content config helpers", () => {
  it("normalizes missing config with defaults", () => {
    expect(normalizeConfig(undefined)).toEqual(DEFAULT_CONFIG);
  });

  it("derives silence threshold from speech threshold", () => {
    const config = normalizeConfig({ speechThreshold: 0.04, gracePeriod: 1200 });
    expect(config.speechThreshold).toBe(0.04);
    expect(config.silenceThreshold).toBe(0.04 * SILENCE_RATIO);
    expect(config.gracePeriod).toBe(1200);
  });

  it("builds default audio constraints", () => {
    expect(buildAudioConstraints(null)).toEqual({
      echoCancellation: true,
      noiseSuppression: false,
      autoGainControl: true,
    });
  });

  it("adds exact device id when present", () => {
    expect(buildAudioConstraints("mic-1")).toEqual({
      echoCancellation: true,
      noiseSuppression: false,
      autoGainControl: true,
      deviceId: { exact: "mic-1" },
    });
  });
});

describe("migrateConfig", () => {
  it("migrates old flat config to per-mode config", () => {
    const flat = { speechThreshold: 0.05, silenceThreshold: 0.025, gracePeriod: 2000 };
    const result = migrateConfig(flat);
    expect(result.auto.speechThreshold).toBe(0.05);
    expect(result.auto.gracePeriod).toBe(2000);
    expect(result.autoOff.speechThreshold).toBe(0.05);
    expect(result.pushToTalk.speechThreshold).toBe(0.05);
  });

  it("preserves already per-mode config", () => {
    const perMode = {
      auto: { speechThreshold: 0.01, silenceThreshold: 0.005, gracePeriod: 1000 },
      autoOff: { speechThreshold: 0.02, silenceThreshold: 0.01, gracePeriod: 2000 },
      pushToTalk: { speechThreshold: 0.03, silenceThreshold: 0.015, gracePeriod: 3000 },
    };
    const result = migrateConfig(perMode);
    expect(result.auto.speechThreshold).toBe(0.01);
    expect(result.autoOff.speechThreshold).toBe(0.02);
    expect(result.pushToTalk.speechThreshold).toBe(0.03);
  });

  it("returns defaults for undefined", () => {
    const result = migrateConfig(undefined);
    expect(result).toEqual(DEFAULT_PER_MODE_CONFIG);
  });

  it("returns defaults for null", () => {
    const result = migrateConfig(null);
    expect(result).toEqual(DEFAULT_PER_MODE_CONFIG);
  });
});

describe("getConfigForMode", () => {
  const perMode = {
    auto: { speechThreshold: 0.01, silenceThreshold: 0.005, gracePeriod: 1000 },
    autoOff: { speechThreshold: 0.02, silenceThreshold: 0.01, gracePeriod: 2000 },
    pushToTalk: { speechThreshold: 0.03, silenceThreshold: 0.015, gracePeriod: 3000 },
  };

  it("returns auto config for auto mode", () => {
    expect(getConfigForMode(perMode, MODES.auto).speechThreshold).toBe(0.01);
  });

  it("returns autoOff config for auto-off mode", () => {
    expect(getConfigForMode(perMode, MODES.autoOff).speechThreshold).toBe(0.02);
  });

  it("returns pushToTalk config for push-to-talk mode", () => {
    expect(getConfigForMode(perMode, MODES.pushToTalk).speechThreshold).toBe(0.03);
  });

  it("falls back to auto config for off mode", () => {
    expect(getConfigForMode(perMode, MODES.off).speechThreshold).toBe(0.01);
  });
});

describe("setConfigForMode", () => {
  it("updates only the target mode", () => {
    const newConfig = { speechThreshold: 0.1, silenceThreshold: 0.05, gracePeriod: 4000 };
    const result = setConfigForMode(DEFAULT_PER_MODE_CONFIG, MODES.autoOff, newConfig);
    expect(result.autoOff).toEqual(newConfig);
    expect(result.auto).toEqual(DEFAULT_PER_MODE_CONFIG.auto);
    expect(result.pushToTalk).toEqual(DEFAULT_PER_MODE_CONFIG.pushToTalk);
  });

  it("returns unchanged config for off mode", () => {
    const newConfig = { speechThreshold: 0.1, silenceThreshold: 0.05, gracePeriod: 4000 };
    const result = setConfigForMode(DEFAULT_PER_MODE_CONFIG, MODES.off, newConfig);
    expect(result).toBe(DEFAULT_PER_MODE_CONFIG);
  });
});
