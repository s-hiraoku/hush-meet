export const DEFAULT_CONFIG = {
  speechThreshold: 0.025,
  silenceThreshold: 0.0125,
  gracePeriod: 1500,
} as const;

export const THRESHOLD_RANGE = {
  min: 0.005,
  max: 0.1,
  step: 0.001,
} as const;

export const GRACE_RANGE = {
  min: 500,
  max: 4000,
  step: 100,
} as const;

export const SILENCE_RATIO = 0.5;

export const STORAGE_KEYS = {
  enabled: "hushMeetEnabled",
  config: "hushMeetConfig",
  state: "hushMeetState",
  level: "hushMeetLevel",
} as const;

export const APP_VERSION = "1.0.0";
