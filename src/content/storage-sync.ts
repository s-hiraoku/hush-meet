import { STORAGE_KEYS } from "../constants.ts";

export function persistState(state: string) {
  void chrome.storage.local.set({ [STORAGE_KEYS.state]: state });
}

export function persistMeters(level: number, spectrum: number[]) {
  void chrome.storage.local.set({
    [STORAGE_KEYS.level]: level,
    [STORAGE_KEYS.spectrum]: spectrum,
  });
}

export function persistIdleSnapshot() {
  void chrome.storage.local.set({
    [STORAGE_KEYS.state]: "IDLE",
    [STORAGE_KEYS.level]: 0,
    [STORAGE_KEYS.spectrum]: [],
  });
}

export function persistErrorState(errorMsg: string) {
  void chrome.storage.local.set({
    [STORAGE_KEYS.state]: "ERROR",
    [STORAGE_KEYS.error]: errorMsg,
  });
}
