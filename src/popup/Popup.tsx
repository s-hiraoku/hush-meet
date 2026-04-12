import { useEffect, useRef, useState } from "react";
import {
  THRESHOLD_RANGE,
  GRACE_RANGE,
  APP_VERSION,
  THEMES,
  MODES,
  type ThemeId,
  type ModeId,
} from "../constants";
import { isModeActive } from "../mode-control.ts";
import { matchesShortcut } from "../shortcut.ts";
import { t, onLocaleChange, getActiveLang, type LocaleId } from "../i18n.ts";
import { Equalizer } from "./Equalizer";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { GameLauncher } from "./GameLauncher";
import { MicToggleButton } from "./MicToggleButton";
import { ModeGrid } from "./ModeGrid";
import { usePopupStorage } from "./usePopupStorage";
import { ShortcutSetting } from "./ShortcutSetting";
import {
  savePopupConfig,
  savePopupMicDevice,
  savePopupMode,
  savePopupShortcut,
} from "./storage-actions";

const stateLabels: Record<string, { key: string; css: string }> = {
  IDLE: { key: "stateIdle", css: "" },
  MUTED: { key: "stateMuted", css: "muted" },
  UNMUTING: { key: "stateUnmuting", css: "speaking" },
  SPEAKING: { key: "stateSpeaking", css: "speaking" },
  GRACE: { key: "stateGrace", css: "grace" },
  ERROR: { key: "stateError", css: "error" },
};

const errorMessages: Record<string, string> = {
  mic_permission_denied: "errorMicPermissionDenied",
  mic_not_found: "errorMicNotFound",
  mic_in_use: "errorMicInUse",
  mic_unknown_error: "errorMicUnknown",
};

function applyTheme(themeId: ThemeId) {
  if (themeId === THEMES.default) {
    document.body.removeAttribute("data-theme");
  } else {
    document.body.setAttribute("data-theme", themeId);
  }
}

function getStatusText(state: string, mode: ModeId, stateInfo: { key: string }) {
  if (mode === MODES.off) return t("modeOffDesc");
  if (state === "MUTED") {
    if (mode === MODES.autoOff) return t("stateWaitingManualUnmute");
    if (mode === MODES.pushToTalk) return t("statePushToTalk");
  }
  return t(stateInfo.key);
}

export function Popup() {
  const [recordingShortcut, setRecordingShortcut] = useState(false);
  const [shortcutHint, setShortcutHint] = useState(false);
  const [, setRenderKey] = useState(0);
  const shortcutHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    gracePeriod,
    isLoaded,
    level,
    locale,
    micDevices,
    micError,
    mode,
    selectedMicId,
    setGracePeriod,
    setLocaleState,
    setSelectedMicId,
    setShortcutKey,
    setTheme,
    setThreshold,
    shortcutKey,
    state,
    switchMode,
    theme,
    threshold,
  } = usePopupStorage({ applyTheme });

  useEffect(() => {
    return onLocaleChange(() => setRenderKey((k) => k + 1));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (recordingShortcut) return;
      if (shortcutKey && matchesShortcut(e, shortcutKey)) {
        e.preventDefault();
        setShortcutHint(true);
        if (shortcutHintTimeoutRef.current) {
          clearTimeout(shortcutHintTimeoutRef.current);
        }
        shortcutHintTimeoutRef.current = setTimeout(() => {
          shortcutHintTimeoutRef.current = null;
          setShortcutHint(false);
        }, 4000);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => {
      window.removeEventListener("keydown", handler, true);
      if (shortcutHintTimeoutRef.current) {
        clearTimeout(shortcutHintTimeoutRef.current);
        shortcutHintTimeoutRef.current = null;
      }
    };
  }, [shortcutKey, recordingShortcut]);

  const resolvedMode = mode ?? MODES.off;
  const isOff = resolvedMode === MODES.off;
  const showShortcutSetting = isModeActive(resolvedMode);
  const stateInfo = stateLabels[state] ?? stateLabels.IDLE;
  const levelPct = Math.min(100, (level / THRESHOLD_RANGE.max) * 100);
  const thresholdPct = Math.min(100, (threshold / THRESHOLD_RANGE.max) * 100);

  const saveConfig = (speech: number, grace: number) => {
    savePopupConfig(resolvedMode, speech, grace);
  };

  const handleThresholdChange = (val: number) => {
    setThreshold(val);
    saveConfig(val, gracePeriod);
  };

  const handleGraceChange = (val: number) => {
    setGracePeriod(val);
    saveConfig(threshold, val);
  };

  const handleThemeChange = (themeId: ThemeId) => {
    setTheme(themeId);
    applyTheme(themeId);
  };

  const handleLocaleChange = (loc: LocaleId) => {
    setLocaleState(loc);
  };

  const handleMicChange = (deviceId: string) => {
    setSelectedMicId(deviceId);
    savePopupMicDevice(deviceId);
  };

  const handleModeChange = (newMode: ModeId) => {
    switchMode(newMode);
    savePopupMode(newMode);
  };

  const handleShortcutRecord = (e: React.KeyboardEvent) => {
    e.preventDefault();
    const parts: string[] = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.shiftKey) parts.push("Shift");
    if (e.altKey) parts.push("Alt");
    if (e.metaKey) parts.push("Cmd");
    if (e.key !== "Control" && e.key !== "Shift" && e.key !== "Alt" && e.key !== "Meta") {
      parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
      const sc = parts.join("+");
      setShortcutKey(sc);
      setRecordingShortcut(false);
      savePopupShortcut(sc);
    }
  };

  return (
    <div className="popup">
      <span className="screw screw-tl" />
      <span className="screw screw-tr" />
      <span className="screw screw-bl" />
      <span className="screw screw-br" />
      <div className="header">
        <h1>Hush Meet</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="version">v{APP_VERSION}</span>
          <GameLauncher />
          <LocaleSwitcher current={locale} onChange={handleLocaleChange} />
          <ThemeSwitcher current={theme} onChange={handleThemeChange} />
        </div>
      </div>

      <div className="status">
        <span className={`status-dot ${isOff ? "" : stateInfo.css}`} />
        <span className="status-text">
          {isLoaded ? getStatusText(state, resolvedMode, stateInfo) : "Loading…"}
        </span>
      </div>

      <div className="meter">
        <div className="meter-label">{t("micLevel")}</div>
        <div className="meter-bar-bg">
          <div
            className={`meter-bar ${level > threshold ? "hot" : ""}`}
            style={{ width: `${levelPct}%` }}
          />
          <div className="threshold-marker" style={{ left: `${thresholdPct}%` }} />
        </div>
      </div>

      <Equalizer />

      {micError && (
        <div className="error-banner">{t(errorMessages[micError] ?? "errorMicUnknown")}</div>
      )}

      <ModeGrid isLoaded={isLoaded} mode={resolvedMode} onSelect={handleModeChange} />

      {isLoaded && <MicToggleButton mode={resolvedMode} state={state} />}

      {shortcutHint && <div className="shortcut-hint">{t("shortcutHintPopup")}</div>}

      <div className="settings">
        <div className="setting">
          <div className="setting-header">
            <span className="setting-label">{t("sensitivity")}</span>
            <span className="setting-value">{threshold.toFixed(3)}</span>
          </div>
          <input
            type="range"
            min={THRESHOLD_RANGE.min}
            max={THRESHOLD_RANGE.max}
            step={THRESHOLD_RANGE.step}
            value={threshold}
            onChange={(e) => handleThresholdChange(parseFloat(e.target.value))}
          />
        </div>

        <div className="setting">
          <div className="setting-header">
            <span className="setting-label">{t("graceTime")}</span>
            <span className="setting-value">
              {t("secondsUnit", (gracePeriod / 1000).toFixed(1))}
            </span>
          </div>
          <input
            type="range"
            min={GRACE_RANGE.min}
            max={GRACE_RANGE.max}
            step={GRACE_RANGE.step}
            value={gracePeriod}
            onChange={(e) => handleGraceChange(parseInt(e.target.value))}
          />
        </div>

        {showShortcutSetting && (
          <ShortcutSetting
            recordingShortcut={recordingShortcut}
            shortcutKey={shortcutKey}
            onBlur={() => setRecordingShortcut(false)}
            onClick={() => setRecordingShortcut(true)}
            onKeyDown={handleShortcutRecord}
          />
        )}
      </div>

      {micDevices.length > 0 && (
        <div className="settings" style={{ marginTop: "8px" }}>
          <div className="setting">
            <div className="setting-header">
              <span className="setting-label">{t("micDevice")}</span>
            </div>
            <select
              className="mic-select"
              value={selectedMicId}
              onChange={(e) => handleMicChange(e.target.value)}
            >
              <option value="">{t("micDefault")}</option>
              {micDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || d.deviceId.slice(0, 16)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="footer">
        <div>{t("footer")}</div>
        <a
          className="footer-link"
          href={`https://s-hiraoku.github.io/hush-meet/${getActiveLang() === "ja" ? "" : getActiveLang() + "/"}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("footerDocsLink")}
        </a>
      </div>
    </div>
  );
}
