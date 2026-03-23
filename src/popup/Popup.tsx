import { useEffect, useState } from "react";
import {
  DEFAULT_CONFIG,
  THRESHOLD_RANGE,
  GRACE_RANGE,
  SILENCE_RATIO,
  STORAGE_KEYS,
  APP_VERSION,
  THEMES,
  type ThemeId,
} from "../constants";
import { t, setLocale, onLocaleChange, type LocaleId } from "../i18n.ts";
import { Equalizer } from "./Equalizer";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { LocaleSwitcher } from "./LocaleSwitcher";

interface HushMeetConfig {
  speechThreshold?: number;
  silenceThreshold?: number;
  gracePeriod?: number;
}

interface HushMeetStorage {
  [key: string]: boolean | HushMeetConfig | string | number | undefined;
  hushMeetEnabled?: boolean;
  hushMeetConfig?: HushMeetConfig;
  hushMeetState?: string;
  hushMeetLevel?: number;
}

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

export function Popup() {
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState("IDLE");
  const [level, setLevel] = useState(0);
  const [threshold, setThreshold] = useState<number>(DEFAULT_CONFIG.speechThreshold);
  const [gracePeriod, setGracePeriod] = useState<number>(DEFAULT_CONFIG.gracePeriod);
  const [theme, setTheme] = useState<ThemeId>(THEMES.default);
  const [locale, setLocaleState] = useState<LocaleId>("auto");
  const [micError, setMicError] = useState<string | null>(null);
  const [, setRenderKey] = useState(0);

  useEffect(() => {
    return onLocaleChange(() => setRenderKey((k) => k + 1));
  }, []);

  useEffect(() => {
    chrome.storage.local.get(
      [
        STORAGE_KEYS.enabled,
        STORAGE_KEYS.config,
        STORAGE_KEYS.state,
        STORAGE_KEYS.level,
        STORAGE_KEYS.theme,
        STORAGE_KEYS.locale,
      ],
      (result: HushMeetStorage) => {
        const savedLocale = (result[STORAGE_KEYS.locale] as LocaleId) ?? "auto";
        setLocaleState(savedLocale);
        setLocale(savedLocale);
        const savedTheme = (result[STORAGE_KEYS.theme] as ThemeId) ?? THEMES.default;
        setTheme(savedTheme);
        applyTheme(savedTheme);
        setEnabled(!!result.hushMeetEnabled);
        if (result.hushMeetConfig) {
          setThreshold(result.hushMeetConfig.speechThreshold ?? DEFAULT_CONFIG.speechThreshold);
          setGracePeriod(result.hushMeetConfig.gracePeriod ?? DEFAULT_CONFIG.gracePeriod);
        } else {
          // Store defaults on first launch
          chrome.storage.local.set({
            [STORAGE_KEYS.config]: {
              speechThreshold: DEFAULT_CONFIG.speechThreshold,
              silenceThreshold: DEFAULT_CONFIG.silenceThreshold,
              gracePeriod: DEFAULT_CONFIG.gracePeriod,
            },
          });
        }
        const loadedState = result.hushMeetState ?? "IDLE";
        setState(loadedState);
        if (loadedState === "ERROR") {
          setMicError((result[STORAGE_KEYS.error] as string) ?? null);
          setEnabled(false);
        }
        if (loadedState === "IDLE") {
          setLevel(0);
          chrome.storage.local.set({
            [STORAGE_KEYS.level]: 0,
            [STORAGE_KEYS.spectrum]: [],
          });
        } else {
          setLevel(result.hushMeetLevel ?? 0);
        }
      },
    );

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[STORAGE_KEYS.state]) {
        const newState = changes[STORAGE_KEYS.state].newValue as string;
        setState(newState);
        if (newState !== "ERROR") setMicError(null);
      }
      if (changes[STORAGE_KEYS.error]) {
        setMicError((changes[STORAGE_KEYS.error].newValue as string) ?? null);
      }
      if (changes[STORAGE_KEYS.enabled]) {
        setEnabled(!!changes[STORAGE_KEYS.enabled].newValue);
      }
      if (changes[STORAGE_KEYS.level])
        setLevel((changes[STORAGE_KEYS.level].newValue as number) ?? 0);
      if (changes[STORAGE_KEYS.config]) {
        const cfg = changes[STORAGE_KEYS.config].newValue as HushMeetConfig;
        if (cfg) {
          setThreshold(cfg.speechThreshold ?? DEFAULT_CONFIG.speechThreshold);
          setGracePeriod(cfg.gracePeriod ?? DEFAULT_CONFIG.gracePeriod);
        }
      }
      if (changes[STORAGE_KEYS.theme]) {
        const themeId = changes[STORAGE_KEYS.theme].newValue as ThemeId;
        setTheme(themeId);
        applyTheme(themeId);
      }
      if (changes[STORAGE_KEYS.locale]) {
        const loc = changes[STORAGE_KEYS.locale].newValue as LocaleId;
        setLocaleState(loc);
        setLocale(loc);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const saveConfig = (speech: number, grace: number) => {
    chrome.storage.local.set({
      [STORAGE_KEYS.config]: {
        speechThreshold: speech,
        silenceThreshold: speech * SILENCE_RATIO,
        gracePeriod: grace,
      },
    });
  };

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    chrome.storage.local.set({ [STORAGE_KEYS.enabled]: checked });
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

  const stateInfo = stateLabels[state] ?? stateLabels.IDLE;
  const levelPct = Math.min(100, (level / THRESHOLD_RANGE.max) * 100);
  const thresholdPct = Math.min(100, (threshold / THRESHOLD_RANGE.max) * 100);

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
          <LocaleSwitcher current={locale} onChange={handleLocaleChange} />
          <ThemeSwitcher current={theme} onChange={handleThemeChange} />
        </div>
      </div>

      <div className="toggle-row">
        <span className="toggle-label">{t("autoMute")}</span>
        <label className="toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => handleToggle(e.target.checked)}
          />
          <span className="slider" />
        </label>
      </div>

      <div className="status">
        <span className={`status-dot ${stateInfo.css}`} />
        <span className="status-text">{t(stateInfo.key)}</span>
      </div>

      {micError && (
        <div className="error-banner">{t(errorMessages[micError] ?? "errorMicUnknown")}</div>
      )}

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
      </div>

      <div className="footer">{t("footer")}</div>
    </div>
  );
}
