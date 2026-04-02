import { DEFAULT_CONFIG, MODES, SILENCE_RATIO } from "../constants.ts";
import type { ModeId } from "../constants.ts";

export type HushMeetConfig = {
  speechThreshold: number;
  silenceThreshold: number;
  gracePeriod: number;
};

export type PerModeConfig = {
  auto: HushMeetConfig;
  autoOff: HushMeetConfig;
  pushToTalk: HushMeetConfig;
};

export function normalizeConfig(
  config: Partial<HushMeetConfig> | null | undefined,
): HushMeetConfig {
  const speechThreshold = config?.speechThreshold ?? DEFAULT_CONFIG.speechThreshold;
  return {
    speechThreshold,
    silenceThreshold: speechThreshold * SILENCE_RATIO,
    gracePeriod: config?.gracePeriod ?? DEFAULT_CONFIG.gracePeriod,
  };
}

export function isPerModeConfig(value: unknown): value is PerModeConfig {
  return (
    typeof value === "object" &&
    value !== null &&
    "auto" in value &&
    "autoOff" in value &&
    "pushToTalk" in value
  );
}

export const DEFAULT_PER_MODE_CONFIG: PerModeConfig = {
  auto: { ...DEFAULT_CONFIG },
  autoOff: { ...DEFAULT_CONFIG },
  pushToTalk: { ...DEFAULT_CONFIG },
};

const MODE_TO_CONFIG_KEY: Record<string, keyof PerModeConfig> = {
  [MODES.auto]: "auto",
  [MODES.autoOff]: "autoOff",
  [MODES.pushToTalk]: "pushToTalk",
};

export function getConfigForMode(perMode: PerModeConfig, mode: ModeId): HushMeetConfig {
  const key = MODE_TO_CONFIG_KEY[mode] ?? "auto";
  return perMode[key];
}

export function setConfigForMode(
  perMode: PerModeConfig,
  mode: ModeId,
  config: HushMeetConfig,
): PerModeConfig {
  const key = MODE_TO_CONFIG_KEY[mode];
  if (!key) return perMode;
  return { ...perMode, [key]: config };
}

export function migrateConfig(stored: unknown): PerModeConfig {
  if (isPerModeConfig(stored)) {
    return {
      auto: normalizeConfig(stored.auto),
      autoOff: normalizeConfig(stored.autoOff),
      pushToTalk: normalizeConfig(stored.pushToTalk),
    };
  }
  if (typeof stored === "object" && stored !== null && "speechThreshold" in stored) {
    const flat = normalizeConfig(stored as Partial<HushMeetConfig>);
    return { auto: flat, autoOff: { ...flat }, pushToTalk: { ...flat } };
  }
  return { ...DEFAULT_PER_MODE_CONFIG };
}

export function buildAudioConstraints(selectedMicDeviceId: string | null): MediaTrackConstraints {
  const audioConstraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: false,
    autoGainControl: true,
  };

  if (selectedMicDeviceId) {
    audioConstraints.deviceId = { exact: selectedMicDeviceId };
  }

  return audioConstraints;
}
