import { useEffect, useState } from "react";
import {
  DEFAULT_CONFIG,
  DEFAULT_SHORTCUT,
  STORAGE_KEYS,
  THEMES,
  type ThemeId,
  type ModeId,
} from "../constants";
import { normalizeMode } from "../constants.ts";
import { setLocale, type LocaleId } from "../i18n.ts";

interface HushMeetConfig {
  speechThreshold?: number;
  silenceThreshold?: number;
  gracePeriod?: number;
}

interface HushMeetStorage {
  [key: string]: boolean | HushMeetConfig | string | number | undefined;
  hushMeetConfig?: HushMeetConfig;
  hushMeetState?: string;
  hushMeetLevel?: number;
}

export function usePopupStorage({ applyTheme }: { applyTheme: (themeId: ThemeId) => void }) {
  const [state, setState] = useState("IDLE");
  const [level, setLevel] = useState(0);
  const [threshold, setThreshold] = useState<number>(DEFAULT_CONFIG.speechThreshold);
  const [gracePeriod, setGracePeriod] = useState<number>(DEFAULT_CONFIG.gracePeriod);
  const [theme, setTheme] = useState<ThemeId>(THEMES.default);
  const [locale, setLocaleState] = useState<LocaleId>("auto");
  const [micError, setMicError] = useState<string | null>(null);
  const [mode, setMode] = useState<ModeId | null>(null);
  const [shortcutKey, setShortcutKey] = useState(DEFAULT_SHORTCUT);
  const [micDevices, setMicDevices] = useState<{ deviceId: string; label: string }[]>([]);
  const [selectedMicId, setSelectedMicId] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    chrome.storage.local.get([STORAGE_KEYS.micDeviceId, STORAGE_KEYS.micDevices], (result) => {
      setSelectedMicId((result[STORAGE_KEYS.micDeviceId] as string) ?? "");
      const devices = result[STORAGE_KEYS.micDevices] as { deviceId: string; label: string }[];
      if (Array.isArray(devices)) {
        setMicDevices(devices);
      }
    });

    chrome.storage.local.get(
      [
        STORAGE_KEYS.config,
        STORAGE_KEYS.state,
        STORAGE_KEYS.level,
        STORAGE_KEYS.theme,
        STORAGE_KEYS.locale,
        STORAGE_KEYS.mode,
        STORAGE_KEYS.shortcutKey,
      ],
      (result: HushMeetStorage) => {
        const savedLocale = (result[STORAGE_KEYS.locale] as LocaleId) ?? "auto";
        setLocaleState(savedLocale);
        setLocale(savedLocale);

        const normalizedMode = normalizeMode(result[STORAGE_KEYS.mode]);
        setMode(normalizedMode);
        if (
          result[STORAGE_KEYS.mode] === undefined ||
          result[STORAGE_KEYS.mode] !== normalizedMode
        ) {
          chrome.storage.local.set({ [STORAGE_KEYS.mode]: normalizedMode });
        }

        const savedTheme = (result[STORAGE_KEYS.theme] as ThemeId) ?? THEMES.default;
        setTheme(savedTheme);
        applyTheme(savedTheme);

        if (result.hushMeetConfig) {
          setThreshold(result.hushMeetConfig.speechThreshold ?? DEFAULT_CONFIG.speechThreshold);
          setGracePeriod(result.hushMeetConfig.gracePeriod ?? DEFAULT_CONFIG.gracePeriod);
        } else {
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
        setShortcutKey((result[STORAGE_KEYS.shortcutKey] as string) || DEFAULT_SHORTCUT);
        setMicError(
          loadedState === "ERROR" ? ((result[STORAGE_KEYS.error] as string) ?? null) : null,
        );

        if (loadedState === "IDLE") {
          setLevel(0);
          chrome.storage.local.set({
            [STORAGE_KEYS.level]: 0,
            [STORAGE_KEYS.spectrum]: [],
          });
        } else {
          setLevel(result.hushMeetLevel ?? 0);
        }
        setIsLoaded(true);
      },
    );

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[STORAGE_KEYS.micDevices]) {
        const devices = changes[STORAGE_KEYS.micDevices].newValue as {
          deviceId: string;
          label: string;
        }[];
        if (Array.isArray(devices)) {
          setMicDevices(devices);
        }
      }
      if (changes[STORAGE_KEYS.state]) {
        const newState = changes[STORAGE_KEYS.state].newValue as string;
        setState(newState);
        if (newState !== "ERROR") setMicError(null);
      }
      if (changes[STORAGE_KEYS.error]) {
        setMicError((changes[STORAGE_KEYS.error].newValue as string) ?? null);
      }
      if (changes[STORAGE_KEYS.level]) {
        setLevel((changes[STORAGE_KEYS.level].newValue as number) ?? 0);
      }
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
      if (changes[STORAGE_KEYS.mode]) {
        setMode(normalizeMode(changes[STORAGE_KEYS.mode].newValue));
      }
      if (changes[STORAGE_KEYS.shortcutKey]) {
        setShortcutKey((changes[STORAGE_KEYS.shortcutKey].newValue as string) || DEFAULT_SHORTCUT);
      }
      if (changes[STORAGE_KEYS.micDeviceId]) {
        setSelectedMicId((changes[STORAGE_KEYS.micDeviceId].newValue as string) ?? "");
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [applyTheme]);

  return {
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
    setMode,
    setSelectedMicId,
    setShortcutKey,
    setTheme,
    setThreshold,
    shortcutKey,
    state,
    theme,
    threshold,
  };
}
