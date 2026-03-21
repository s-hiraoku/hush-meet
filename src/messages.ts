export type Messages = Record<
  string,
  { message: string; placeholders?: Record<string, { content: string }> }
>;

export const en: Messages = {
  extName: { message: "Hush Meet" },
  extDescription: {
    message: "Automatically mutes your microphone on Google Meet when you're not speaking",
  },
  autoMute: { message: "Auto Mute" },
  stateIdle: { message: "Disabled" },
  stateMuted: { message: "Muted (standby)" },
  stateUnmuting: { message: "Unmuting…" },
  stateSpeaking: { message: "Speaking" },
  stateGrace: { message: "Grace period…" },
  micLevel: { message: "Mic Input Level" },
  spectrum: { message: "Spectrum" },
  sensitivity: { message: "Speech Detection Sensitivity" },
  graceTime: { message: "Grace Period (after speech)" },
  secondsUnit: {
    message: "$VALUE$s",
    placeholders: { value: { content: "$1" } },
  },
  footer: { message: "Active on Google Meet tabs" },
  themeSwitcher: { message: "Switch Theme" },
  localeSwitcher: { message: "Language" },
  localeAuto: { message: "Auto" },
  localeEn: { message: "English" },
  localeJa: { message: "Japanese" },
};

export const ja: Messages = {
  extName: { message: "Hush Meet" },
  extDescription: { message: "Google Meetで話していない時に自動でミュートし、雑音を防止します" },
  autoMute: { message: "自動ミュート" },
  stateIdle: { message: "無効" },
  stateMuted: { message: "ミュート中（待機）" },
  stateUnmuting: { message: "ミュート解除中…" },
  stateSpeaking: { message: "発話中" },
  stateGrace: { message: "猶予中…" },
  micLevel: { message: "マイク入力レベル" },
  spectrum: { message: "スペクトラム" },
  sensitivity: { message: "発話検出の感度" },
  graceTime: { message: "猶予時間（発話後ミュートまで）" },
  secondsUnit: {
    message: "$VALUE$秒",
    placeholders: { value: { content: "$1" } },
  },
  footer: { message: "Google Meet タブで有効になります" },
  themeSwitcher: { message: "テーマ切替" },
  localeSwitcher: { message: "言語" },
  localeAuto: { message: "自動" },
  localeEn: { message: "English" },
  localeJa: { message: "日本語" },
};
