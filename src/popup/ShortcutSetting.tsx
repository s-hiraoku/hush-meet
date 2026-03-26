import { t } from "../i18n.ts";

export function ShortcutSetting({
  recordingShortcut,
  shortcutKey,
  onBlur,
  onClick,
  onKeyDown,
}: {
  recordingShortcut: boolean;
  shortcutKey: string;
  onBlur: () => void;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  return (
    <div className="setting">
      <div className="setting-header">
        <span className="setting-label">{t("shortcutLabel")}</span>
        <button
          className={`shortcut-btn${recordingShortcut ? " recording" : ""}`}
          onClick={onClick}
          onKeyDown={recordingShortcut ? onKeyDown : undefined}
          onBlur={onBlur}
        >
          {recordingShortcut ? t("shortcutRecording") : shortcutKey}
        </button>
      </div>
    </div>
  );
}
