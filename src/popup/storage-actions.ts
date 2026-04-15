import { SILENCE_RATIO, STORAGE_KEYS, type ModeId } from "../constants";
import { migrateConfig, setConfigForMode } from "../content/config.ts";
import { persistModeSelection } from "../mode-control.ts";

export type MicToggleAction = "toggle" | "mute" | "unmute";

interface MicToggleRequest {
  action: MicToggleAction;
  requestedAt: number;
}

export function savePopupConfig(mode: ModeId, speechThreshold: number, gracePeriod: number) {
  chrome.storage.local.get([STORAGE_KEYS.config], (result) => {
    const perMode = migrateConfig(result[STORAGE_KEYS.config]);
    const updated = setConfigForMode(perMode, mode, {
      speechThreshold,
      silenceThreshold: speechThreshold * SILENCE_RATIO,
      gracePeriod,
    });
    void chrome.storage.local.set({ [STORAGE_KEYS.config]: updated });
  });
}

export function savePopupMode(mode: ModeId) {
  persistModeSelection(mode);
}

export function savePopupShortcut(shortcut: string) {
  void chrome.storage.local.set({ [STORAGE_KEYS.shortcutKey]: shortcut });
}

export function savePopupMicDevice(deviceId: string) {
  void chrome.storage.local.set({ [STORAGE_KEYS.micDeviceId]: deviceId });
}

export function savePopupMicToggle(action: MicToggleAction) {
  const request: MicToggleRequest = {
    action,
    requestedAt: Date.now(),
  };
  void chrome.storage.local.set({ [STORAGE_KEYS.micToggleAction]: request });
}
