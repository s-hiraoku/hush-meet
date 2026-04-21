import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, MODES, SILENCE_RATIO } from "../constants.ts";
import {
  CONTENT_STATE,
  getNextAudioState,
  getNextManualMuteState,
} from "../content/state-machine.ts";

describe("content state machine", () => {
  const speechThreshold = DEFAULT_CONFIG.speechThreshold;
  const silenceThreshold = speechThreshold * SILENCE_RATIO;

  it("auto mode can unmute from muted on speech", () => {
    expect(
      getNextAudioState({
        currentState: CONTENT_STATE.MUTED,
        mode: MODES.auto,
        rms: speechThreshold + 0.01,
        speechThreshold,
        silenceThreshold,
      }),
    ).toBe(CONTENT_STATE.UNMUTING);
  });

  it("auto-off mode does not unmute from muted on speech", () => {
    expect(
      getNextAudioState({
        currentState: CONTENT_STATE.MUTED,
        mode: MODES.autoOff,
        rms: speechThreshold + 0.01,
        speechThreshold,
        silenceThreshold,
      }),
    ).toBeNull();
  });

  it("push-to-talk mode does not unmute from muted on speech", () => {
    expect(
      getNextAudioState({
        currentState: CONTENT_STATE.MUTED,
        mode: MODES.pushToTalk,
        rms: speechThreshold + 0.01,
        speechThreshold,
        silenceThreshold,
      }),
    ).toBeNull();
  });

  it("manual meet mute does not affect off mode", () => {
    expect(
      getNextManualMuteState({
        currentState: CONTENT_STATE.MUTED,
        meetMuted: false,
        mode: MODES.off,
        mutingByExtension: false,
      }),
    ).toBeNull();
  });

  it("manual meet unmute updates muted to speaking in auto-off", () => {
    expect(
      getNextManualMuteState({
        currentState: CONTENT_STATE.MUTED,
        meetMuted: false,
        mode: MODES.autoOff,
        mutingByExtension: false,
      }),
    ).toBe(CONTENT_STATE.SPEAKING);
  });

  it("speaking transitions to grace on silence", () => {
    expect(
      getNextAudioState({
        currentState: CONTENT_STATE.SPEAKING,
        mode: MODES.autoOff,
        rms: silenceThreshold - 0.001,
        speechThreshold,
        silenceThreshold,
      }),
    ).toBe(CONTENT_STATE.GRACE);
  });

  it("grace returns to speaking on renewed audio", () => {
    expect(
      getNextAudioState({
        currentState: CONTENT_STATE.GRACE,
        mode: MODES.autoOff,
        rms: silenceThreshold + 0.001,
        speechThreshold,
        silenceThreshold,
      }),
    ).toBe(CONTENT_STATE.SPEAKING);
  });

  it("returns null when speaking audio stays above silence threshold", () => {
    expect(
      getNextAudioState({
        currentState: CONTENT_STATE.SPEAKING,
        mode: MODES.auto,
        rms: silenceThreshold + 0.01,
        speechThreshold,
        silenceThreshold,
      }),
    ).toBeNull();
  });

  it("returns null when grace stays below silence threshold", () => {
    expect(
      getNextAudioState({
        currentState: CONTENT_STATE.GRACE,
        mode: MODES.auto,
        rms: silenceThreshold - 0.01,
        speechThreshold,
        silenceThreshold,
      }),
    ).toBeNull();
  });

  it("auto mode can unmute from idle on speech (recovery when initial mute failed)", () => {
    expect(
      getNextAudioState({
        currentState: CONTENT_STATE.IDLE,
        mode: MODES.auto,
        rms: speechThreshold + 0.01,
        speechThreshold,
        silenceThreshold,
      }),
    ).toBe(CONTENT_STATE.UNMUTING);
  });

  it("auto-off mode stays idle on speech", () => {
    expect(
      getNextAudioState({
        currentState: CONTENT_STATE.IDLE,
        mode: MODES.autoOff,
        rms: speechThreshold + 0.01,
        speechThreshold,
        silenceThreshold,
      }),
    ).toBeNull();
  });

  it("returns null for error state regardless of speech", () => {
    expect(
      getNextAudioState({
        currentState: CONTENT_STATE.ERROR,
        mode: MODES.auto,
        rms: speechThreshold + 0.01,
        speechThreshold,
        silenceThreshold,
      }),
    ).toBeNull();
  });

  it("returns null for idle and error manual mute paths", () => {
    expect(
      getNextManualMuteState({
        currentState: CONTENT_STATE.IDLE,
        meetMuted: true,
        mode: MODES.auto,
        mutingByExtension: false,
      }),
    ).toBeNull();
    expect(
      getNextManualMuteState({
        currentState: CONTENT_STATE.ERROR,
        meetMuted: false,
        mode: MODES.auto,
        mutingByExtension: false,
      }),
    ).toBeNull();
  });

  it("returns null while extension is muting", () => {
    expect(
      getNextManualMuteState({
        currentState: CONTENT_STATE.MUTED,
        meetMuted: false,
        mode: MODES.autoOff,
        mutingByExtension: true,
      }),
    ).toBeNull();
  });

  it("returns muted when user manually mutes from speaking", () => {
    expect(
      getNextManualMuteState({
        currentState: CONTENT_STATE.SPEAKING,
        meetMuted: true,
        mode: MODES.auto,
        mutingByExtension: false,
      }),
    ).toBe(CONTENT_STATE.MUTED);
  });

  it("returns null for no-op manual mute transitions", () => {
    expect(
      getNextManualMuteState({
        currentState: CONTENT_STATE.MUTED,
        meetMuted: true,
        mode: MODES.auto,
        mutingByExtension: false,
      }),
    ).toBeNull();
    expect(
      getNextManualMuteState({
        currentState: CONTENT_STATE.SPEAKING,
        meetMuted: null,
        mode: MODES.auto,
        mutingByExtension: false,
      }),
    ).toBeNull();
  });
});
