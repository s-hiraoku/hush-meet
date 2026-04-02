import { SILENCE_RATIO, STORAGE_KEYS, type ModeId } from "../constants";
import { migrateConfig, setConfigForMode } from "../content/config.ts";

export function savePopupConfig(mode: ModeId, speechThreshold: number, gracePeriod: number) {
  chrome.storage.local.get([STORAGE_KEYS.config], (result) => {
    const perMode = migrateConfig(result[STORAGE_KEYS.config]);
    const updated = setConfigForMode(perMode, mode, {
      speechThreshold,
      silenceThreshold: speechThreshold * SILENCE_RATIO,
      gracePeriod,
    });
    chrome.storage.local.set({ [STORAGE_KEYS.config]: updated });
  });
}

export function savePopupMode(mode: ModeId) {
  chrome.storage.local.set({ [STORAGE_KEYS.mode]: mode });
}

export function savePopupShortcut(shortcut: string) {
  chrome.storage.local.set({ [STORAGE_KEYS.shortcutKey]: shortcut });
}

export function savePopupMicDevice(deviceId: string) {
  chrome.storage.local.set({ [STORAGE_KEYS.micDeviceId]: deviceId });
}

export function savePopupMicToggle(action: string) {
  void chrome.storage.local.set({ [STORAGE_KEYS.micToggleAction]: action });
}
