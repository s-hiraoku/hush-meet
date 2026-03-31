export const DEFAULT_CONFIG = {
  speechThreshold: 0.025,
  silenceThreshold: 0.0125,
  gracePeriod: 1500,
} as const;

export const THRESHOLD_RANGE = {
  min: 0.005,
  max: 0.25,
  step: 0.001,
} as const;

export const GRACE_RANGE = {
  min: 500,
  max: 4000,
  step: 100,
} as const;

export const SILENCE_RATIO = 0.5;

export const STORAGE_KEYS = {
  config: "hushMeetConfig",
  state: "hushMeetState",
  level: "hushMeetLevel",
  spectrum: "hushMeetSpectrum",
  theme: "hushMeetTheme",
  locale: "hushMeetLocale",
  error: "hushMeetError",
  micDeviceId: "hushMeetMicDeviceId",
  micDevices: "hushMeetMicDevices",
  mode: "hushMeetMode",
  shortcutKey: "hushMeetShortcutKey",
} as const;

export const MODES = {
  off: "off",
  auto: "auto",
  autoOff: "auto-off",
  pushToTalk: "push-to-talk",
} as const;

export type ModeId = (typeof MODES)[keyof typeof MODES];

export function normalizeMode(value: unknown): ModeId {
  switch (value) {
    case MODES.auto:
    case MODES.autoOff:
    case MODES.pushToTalk:
    case MODES.off:
      return value;
    default:
      return MODES.auto;
  }
}

export const THEMES = {
  default: "default",
  analogRadio: "analog-radio",
  boombox: "boombox",
  retroFuture: "retro-future",
} as const;

export type ThemeId = (typeof THEMES)[keyof typeof THEMES];

export const THEME_LIST: { id: ThemeId; label: string }[] = [
  { id: THEMES.default, label: "Default" },
  { id: THEMES.analogRadio, label: "Analog Radio" },
  { id: THEMES.boombox, label: "Boombox" },
  { id: THEMES.retroFuture, label: "Retro Future" },
];

export const DEFAULT_SHORTCUT = "Ctrl+Shift+M";

export const APP_VERSION = "1.0.10";
