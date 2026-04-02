import { useRef, useCallback } from "react";
import { MODES, type ModeId } from "../constants";
import { t } from "../i18n.ts";
import { savePopupMicToggle } from "./storage-actions";

const MicIcon = ({ strikeThrough }: { strikeThrough: boolean }) => (
  <svg
    className="mic-toggle-icon"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
    {strikeThrough && <line x1="1" y1="1" x2="23" y2="23" />}
  </svg>
);

interface Props {
  mode: ModeId;
  state: string;
}

export function MicToggleButton({ mode, state }: Props) {
  const isOff = mode === MODES.off;
  const isPtt = mode === MODES.pushToTalk;
  const isMuted = state === "MUTED" || state === "IDLE";

  // Debounce rapid PTT writes — skip if already in the desired state
  const lastAction = useRef("");
  const sendAction = useCallback((action: string) => {
    if (action === lastAction.current) return;
    lastAction.current = action;
    savePopupMicToggle(action);
  }, []);

  const label = isOff
    ? t("micToggleEnable")
    : isPtt && isMuted
      ? t("micTogglePtt")
      : isMuted
        ? t("micToggleUnmute")
        : t("micToggleMute");

  const cssClass = `mic-toggle-btn ${
    isOff ? "mic-toggle-enable" : isMuted ? "mic-toggle-unmute" : "mic-toggle-mute"
  }`;

  const handlers =
    isPtt && !isOff
      ? {
          onMouseDown: () => sendAction("unmute"),
          onMouseUp: () => sendAction("mute"),
          onMouseLeave: () => {
            if (!isMuted) sendAction("mute");
          },
          onTouchStart: () => sendAction("unmute"),
          onTouchEnd: () => sendAction("mute"),
        }
      : {
          onClick: () => {
            lastAction.current = "";
            savePopupMicToggle("toggle");
          },
        };

  return (
    <button type="button" className={cssClass} {...handlers}>
      <MicIcon strikeThrough={isOff || isMuted} />
      <span>{label}</span>
    </button>
  );
}
