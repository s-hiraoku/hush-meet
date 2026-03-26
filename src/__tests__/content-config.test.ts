import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, SILENCE_RATIO } from "../constants.ts";
import { buildAudioConstraints, normalizeConfig } from "../content/config.ts";

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
