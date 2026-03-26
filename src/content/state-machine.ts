import { MODES } from "../constants.ts";
import type { ModeId } from "../constants.ts";

export const CONTENT_STATE = {
  IDLE: "IDLE",
  MUTED: "MUTED",
  UNMUTING: "UNMUTING",
  SPEAKING: "SPEAKING",
  GRACE: "GRACE",
  ERROR: "ERROR",
} as const;

export type ContentState = (typeof CONTENT_STATE)[keyof typeof CONTENT_STATE];

export function getNextAudioState(args: {
  currentState: ContentState;
  mode: ModeId;
  rms: number;
  speechThreshold: number;
  silenceThreshold: number;
}): ContentState | null {
  const { currentState, mode, rms, speechThreshold, silenceThreshold } = args;

  switch (currentState) {
    case CONTENT_STATE.MUTED:
      if (mode === MODES.auto && rms > speechThreshold) {
        return CONTENT_STATE.UNMUTING;
      }
      return null;
    case CONTENT_STATE.SPEAKING:
      if (rms < silenceThreshold) {
        return CONTENT_STATE.GRACE;
      }
      return null;
    case CONTENT_STATE.GRACE:
      if (rms > silenceThreshold) {
        return CONTENT_STATE.SPEAKING;
      }
      return null;
    default:
      return null;
  }
}

export function getNextManualMuteState(args: {
  currentState: ContentState;
  meetMuted: boolean | null;
  mode: ModeId;
  mutingByExtension: boolean;
}): ContentState | null {
  const { currentState, meetMuted, mode, mutingByExtension } = args;
  if (mutingByExtension || mode === MODES.off) return null;
  if (currentState === CONTENT_STATE.IDLE || currentState === CONTENT_STATE.ERROR) return null;
  if (meetMuted === true && currentState !== CONTENT_STATE.MUTED) return CONTENT_STATE.MUTED;
  if (meetMuted === false && currentState === CONTENT_STATE.MUTED) return CONTENT_STATE.SPEAKING;
  return null;
}
