import { SILENCE_RATIO, STORAGE_KEYS, type ModeId } from "../constants";

export function savePopupConfig(speechThreshold: number, gracePeriod: number) {
  chrome.storage.local.set({
    [STORAGE_KEYS.config]: {
      speechThreshold,
      silenceThreshold: speechThreshold * SILENCE_RATIO,
      gracePeriod,
    },
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
