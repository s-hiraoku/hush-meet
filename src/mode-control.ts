import { MODES, type ModeId } from "./constants.ts";

export function isModeActive(mode: ModeId): boolean {
  return mode !== MODES.off;
}

export function shouldAutoUnmuteForMode(mode: ModeId): boolean {
  return mode === MODES.auto;
}

export function shouldUsePushToTalkHold(mode: ModeId): boolean {
  return mode === MODES.pushToTalk;
}

export function shouldStopForPersistedMode({
  persistedMode,
  isListening,
  isStarting,
}: {
  persistedMode: ModeId;
  isListening: boolean;
  isStarting: boolean;
}): boolean {
  return persistedMode === MODES.off && (isListening || isStarting);
}
