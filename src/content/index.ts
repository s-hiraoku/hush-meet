/**
 * Hush Meet - Content Script
 * Google Meet の自動ミュート制御
 */

import {
  DEFAULT_CONFIG,
  DEFAULT_SHORTCUT,
  MODES,
  STORAGE_KEYS,
  normalizeMode,
} from "../constants.ts";
import type { ModeId } from "../constants.ts";
import { isModeActive, persistModeSelection, shouldUsePushToTalkHold } from "../mode-control.ts";
import { computeVoiceBins, computeVoiceWeightedRms } from "./voice-detection.ts";
import {
  consumeShortcutEvent,
  getModeSwitchShortcutTarget,
  shouldTriggerShortcutKeyDown,
  shouldTriggerShortcutKeyUp,
} from "./shortcut-controller.ts";
import {
  persistErrorState,
  persistIdleSnapshot,
  persistMeters,
  persistState,
} from "./storage-sync.ts";
import { findMuteButton, inferMuteStateFromButton } from "./meet-dom.ts";
import { clearIntervalTimer, clearTimer } from "./timers.ts";
import { markExtensionMuteAction as runMuteAction } from "./mute-action.ts";
import {
  CONTENT_STATE,
  type ContentState,
  getNextAudioState,
  getNextManualMuteState,
} from "./state-machine.ts";
import {
  buildAudioConstraints,
  DEFAULT_PER_MODE_CONFIG,
  getConfigForMode,
  isPerModeConfig,
  migrateConfig,
  type HushMeetConfig,
  type PerModeConfig,
} from "./config.ts";
const State = CONTENT_STATE;
type StateType = ContentState;

let currentState: StateType = State.IDLE;
let isListening = false;
let isStarting = false;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let micStream: MediaStream | null = null;
let analyseTimerId: ReturnType<typeof setInterval> | null = null;
let graceTimer: ReturnType<typeof setTimeout> | null = null;
let muteObserver: MutationObserver | null = null;
let muteObserverRetryId: ReturnType<typeof setInterval> | null = null;
let startupTimerId: ReturnType<typeof setTimeout> | null = null;
let mutingByExtension = false;
let selectedMicDeviceId: string | null = null;
let selectedMode: ModeId = MODES.off;
let lastActiveMode: ModeId = MODES.auto;
let shortcutKey = DEFAULT_SHORTCUT;
let pttKeyHeld = false;
let listeningRunId = 0;
/** Timestamp until which the audio analysis loop should not auto-mute (shortcut grace) */
let shortcutUnmuteUntil = 0;
let muteObserverDebounceId: ReturnType<typeof setTimeout> | null = null;

let dataArray: Float32Array<ArrayBuffer> | null = null;
let freqData: Uint8Array<ArrayBuffer> | null = null;
let lastMeterWriteTime = 0;
let cachedMuteButton: HTMLElement | null = null;
let voiceStartBin = 0;
let voiceEndBin = 0;
let ensureMuteTimerId: ReturnType<typeof setInterval> | null = null;
let ensureMuteTimeoutId: ReturnType<typeof setTimeout> | null = null;

let config: HushMeetConfig = { ...DEFAULT_CONFIG };
let perModeConfig: PerModeConfig = { ...DEFAULT_PER_MODE_CONFIG };

const MUTE_BUTTON_ATTRS = ["aria-label", "aria-pressed", "data-tooltip", "data-is-muted"] as const;

const log = (msg: string, ...args: unknown[]) => console.log(`[HushMeet] ${msg}`, ...args);
const warn = (msg: string, ...args: unknown[]) => console.warn(`[HushMeet] ${msg}`, ...args);

function getRequestedMicToggleAction(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    "action" in value &&
    typeof (value as { action?: unknown }).action === "string"
  ) {
    return (value as { action: string }).action;
  }
  return "";
}

function markExtensionMuteAction(action: () => void) {
  mutingByExtension = true;
  runMuteAction(action, () => {
    mutingByExtension = false;
  });
}

function getCachedMuteButton(): HTMLElement | null {
  if (cachedMuteButton && cachedMuteButton.isConnected) return cachedMuteButton;
  cachedMuteButton = findMuteButton(warn);
  return cachedMuteButton;
}

function isMeetMuted(): boolean | null {
  return inferMuteStateFromButton(getCachedMuteButton());
}

function toggleMeetMute(shouldMute: boolean): boolean {
  const btn = getCachedMuteButton();
  const currentlyMuted = inferMuteStateFromButton(btn);
  if (currentlyMuted === null) {
    warn("ミュートボタン未検出");
    return false;
  }
  if (currentlyMuted === shouldMute) return true;
  if (btn) {
    markExtensionMuteAction(() => btn.click());
    log(shouldMute ? "ミュートしました" : "ミュート解除しました");
    return true;
  }
  return false;
}

function clearGraceTimer() {
  graceTimer = clearTimer(graceTimer);
}

/** Switch to Off mode when the user manually operates the Meet mute button. */
function switchToOffMode() {
  if (selectedMode === MODES.off) return;
  selectedMode = MODES.off;
  pttKeyHeld = false;
  log("手動ミュート検出 — モードをOffに切り替え");
  stopListening();
  void chrome.storage.local.set({ [STORAGE_KEYS.mode]: MODES.off });
}

function clearEnsureMuteTimers() {
  if (ensureMuteTimerId) {
    ensureMuteTimerId = clearIntervalTimer(ensureMuteTimerId);
  }
  if (ensureMuteTimeoutId) {
    clearTimeout(ensureMuteTimeoutId);
    ensureMuteTimeoutId = null;
  }
}

function startShortcutListener() {
  // window レベルで登録（iframe内フォーカス時もトップフレームのwindowに届く）
  window.addEventListener("keydown", handleShortcutKeyDown, true);
  window.addEventListener("keyup", handleShortcutKeyUp, true);
  log("ショートカットリスナー登録完了");
}

function handleShortcutKeyDown(e: KeyboardEvent) {
  const modeShortcutTarget = getModeSwitchShortcutTarget(e);
  if (modeShortcutTarget) {
    consumeShortcutEvent(e);
    persistModeSelection(modeShortcutTarget);
    return;
  }

  if (
    !shouldTriggerShortcutKeyDown({
      event: e,
      mode: selectedMode,
      pttKeyHeld,
      shortcut: shortcutKey,
    })
  ) {
    return;
  }

  // If mode is Off, ignore mic-toggle shortcut — use mode shortcuts (Ctrl+Shift+0-3) instead
  if (!isModeActive(selectedMode)) {
    return;
  }

  // If listening hasn't started yet, wait for it
  if (!isListening) {
    return;
  }

  consumeShortcutEvent(e);

  if (shouldUsePushToTalkHold(selectedMode)) {
    pttKeyHeld = true;
    shortcutUnmuteUntil = Date.now() + config.gracePeriod;
    transition(State.UNMUTING);
  } else {
    const muted = isMeetMuted();
    if (muted === true || currentState === State.MUTED) {
      // Give the user time to start speaking before auto-mute kicks in
      shortcutUnmuteUntil = Date.now() + config.gracePeriod;
      transition(State.UNMUTING);
    } else if (muted === false || currentState === State.SPEAKING || currentState === State.GRACE) {
      transition(State.MUTED);
    }
  }
}

function handleShortcutKeyUp(e: KeyboardEvent) {
  if (!shouldUsePushToTalkHold(selectedMode)) return;
  if (
    !shouldTriggerShortcutKeyUp({
      event: e,
      mode: selectedMode,
      pttKeyHeld,
      shortcut: shortcutKey,
    })
  ) {
    return;
  }

  consumeShortcutEvent(e);
  pttKeyHeld = false;
  transition(State.MUTED);
}

function transition(newState: StateType) {
  if (currentState === newState) return;
  const prev = currentState;

  switch (newState) {
    case State.UNMUTING: {
      if (!toggleMeetMute(false)) return;
      currentState = State.SPEAKING;
      break;
    }

    case State.GRACE:
      currentState = State.GRACE;
      clearGraceTimer();
      graceTimer = setTimeout(() => {
        if (currentState === State.GRACE) {
          transition(State.MUTED);
        }
      }, config.gracePeriod);
      break;

    case State.MUTED:
      if (!toggleMeetMute(true)) return;
      currentState = State.MUTED;
      clearGraceTimer();
      break;

    case State.SPEAKING:
      currentState = State.SPEAKING;
      clearGraceTimer();
      break;
  }

  log(`状態遷移: ${prev} → ${currentState}`);
  persistState(currentState);
}

// Watch for user-initiated mute changes on the Meet mute button
function startMuteObserver() {
  stopMuteObserver();

  const checkForUserMute = () => {
    const nextState = getNextManualMuteState({
      currentState,
      meetMuted: isMeetMuted(),
      mode: selectedMode,
      mutingByExtension,
    });
    if (nextState === State.MUTED || nextState === State.SPEAKING) {
      log(
        nextState === State.MUTED
          ? "ユーザーが手動でミュートしました"
          : "ユーザーが手動でミュート解除しました",
      );
      switchToOffMode();
    }
  };

  // Debounce: Meet may fire multiple attribute mutations for a single mute toggle.
  const debouncedCheck = () => {
    if (muteObserverDebounceId) clearTimeout(muteObserverDebounceId);
    muteObserverDebounceId = setTimeout(() => {
      muteObserverDebounceId = null;
      checkForUserMute();
    }, 80);
  };

  const btn = findMuteButton(warn);
  if (btn) {
    muteObserver = new MutationObserver(debouncedCheck);
    muteObserver.observe(btn, {
      attributes: true,
      attributeFilter: [...MUTE_BUTTON_ATTRS],
    });
    log("ミュートボタン監視を開始");
  } else {
    // Button not found yet, retry periodically
    muteObserverRetryId = setInterval(() => {
      const b = findMuteButton(warn);
      if (b && isListening) {
        if (muteObserverRetryId) {
          muteObserverRetryId = clearIntervalTimer(muteObserverRetryId);
        }
        muteObserver = new MutationObserver(debouncedCheck);
        muteObserver.observe(b, {
          attributes: true,
          attributeFilter: [...MUTE_BUTTON_ATTRS],
        });
        log("ミュートボタン監視を開始（リトライ）");
      }
    }, 2000);
    // Stop retrying after 30s
    setTimeout(() => {
      muteObserverRetryId = clearIntervalTimer(muteObserverRetryId);
    }, 30000);
  }
}

function stopMuteObserver() {
  if (muteObserver) {
    muteObserver.disconnect();
    muteObserver = null;
  }
  if (muteObserverRetryId) {
    muteObserverRetryId = clearIntervalTimer(muteObserverRetryId);
  }
  if (muteObserverDebounceId) {
    clearTimeout(muteObserverDebounceId);
    muteObserverDebounceId = null;
  }
}

async function ensureAudioContextRunning() {
  if (audioContext && audioContext.state === "suspended") {
    log("AudioContext suspended, resuming...");
    await audioContext.resume();
    log(`AudioContext state: ${audioContext.state}`);
  }
}

function analyseLoop() {
  if (!isListening || !analyser || !audioContext || !isModeActive(selectedMode)) return;

  // Skip analysis if AudioContext is not running
  if (audioContext.state !== "running") {
    void ensureAudioContextRunning();
    return;
  }

  if (!dataArray || !freqData) return;

  analyser.getFloatTimeDomainData(dataArray);
  analyser.getByteFrequencyData(freqData);

  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i] * dataArray[i];
  }
  const rms = Math.sqrt(sum / dataArray.length);

  // Voice-weighted RMS: suppress non-voice noise (keyboard, fan, etc.)
  const { weightedRms } = computeVoiceWeightedRms(rms, freqData, voiceStartBin, voiceEndBin);

  const nextState = getNextAudioState({
    currentState,
    mode: selectedMode,
    rms: weightedRms,
    speechThreshold: config.speechThreshold,
    silenceThreshold: config.silenceThreshold,
  });
  if (nextState) {
    // After a shortcut unmute, suppress silence-triggered muting until the grace window expires.
    // This gives the user time to start speaking before auto-mute kicks in.
    if (
      shortcutUnmuteUntil > 0 &&
      Date.now() < shortcutUnmuteUntil &&
      (nextState === State.GRACE || nextState === State.MUTED)
    ) {
      // Still within shortcut grace — skip auto-mute
    } else {
      if (nextState !== State.GRACE && nextState !== State.MUTED) {
        shortcutUnmuteUntil = 0; // Speech detected, clear the window
      }
      transition(nextState);
    }
  }

  // Spectrum data for equalizer (16 bands)
  const bandCount = 16;
  const bandSize = Math.max(1, Math.floor(freqData.length / bandCount));
  const spectrum: number[] = [];
  for (let b = 0; b < bandCount; b++) {
    let bandSum = 0;
    for (let i = b * bandSize; i < (b + 1) * bandSize && i < freqData.length; i++) {
      bandSum += freqData[i];
    }
    spectrum.push(bandSum / bandSize / 255);
  }

  const now = performance.now();
  if (now - lastMeterWriteTime > 150) {
    lastMeterWriteTime = now;
    persistMeters(rms, spectrum);
  }
}

const ANALYSE_INTERVAL_MS = 20;

function clearStartupTimer() {
  startupTimerId = clearTimer(startupTimerId);
}

function scheduleStartListening(delayMs = 0) {
  clearStartupTimer();
  if (!isModeActive(selectedMode)) return;
  startupTimerId = setTimeout(() => {
    startupTimerId = null;
    void startListening();
  }, delayMs);
}

async function startListening() {
  if (isStarting || isListening) {
    log("startListening already in progress, skipping");
    return;
  }
  if (!isModeActive(selectedMode)) {
    log("mode is off, skipping startListening");
    return;
  }
  isStarting = true;
  const runId = ++listeningRunId;

  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: buildAudioConstraints(selectedMicDeviceId),
    });

    if (runId !== listeningRunId || !isModeActive(selectedMode)) {
      micStream.getTracks().forEach((t) => t.stop());
      return;
    }

    audioContext = new AudioContext();

    // Ensure AudioContext is running (may be suspended without user gesture)
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    if (runId !== listeningRunId || !isModeActive(selectedMode)) {
      void audioContext.close();
      micStream.getTracks().forEach((t) => t.stop());
      audioContext = null;
      micStream = null;
      return;
    }

    // Listen for future suspend/resume events
    audioContext.addEventListener("statechange", () => {
      log(`AudioContext state changed: ${audioContext?.state}`);
      if (audioContext?.state === "suspended" && isListening) {
        void ensureAudioContextRunning();
      }
    });

    const source = audioContext.createMediaStreamSource(micStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.3;
    source.connect(analyser);

    dataArray = new Float32Array(analyser.fftSize);
    freqData = new Uint8Array(analyser.frequencyBinCount);

    const bins = computeVoiceBins(audioContext.sampleRate, analyser.fftSize);
    voiceStartBin = bins.start;
    voiceEndBin = bins.end;

    // Save available mic devices (permission granted, labels available now)
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({ deviceId: d.deviceId, label: d.label }));
      void chrome.storage.local.set({ [STORAGE_KEYS.micDevices]: mics });
    } catch {
      // Non-critical, ignore
    }

    isListening = true;
    log("マイク監視を開始しました");

    // Ensure Meet is muted before starting analysis.
    // Use transition() so state only advances when the mute action succeeds.
    const currentRunId = listeningRunId;
    transition(State.MUTED);

    // If the mute button wasn't found, retry until it is.
    if (currentState !== State.MUTED) {
      log("ミュートボタン未検出、リトライ開始");
      clearEnsureMuteTimers();
      ensureMuteTimerId = setInterval(() => {
        if (!isListening || listeningRunId !== currentRunId) {
          clearEnsureMuteTimers();
          return;
        }
        transition(State.MUTED);
        if (currentState === State.MUTED) {
          log("初期ミュート完了（リトライ）");
          clearEnsureMuteTimers();
        }
      }, 500);
      ensureMuteTimeoutId = setTimeout(() => clearEnsureMuteTimers(), 15000);
    }

    // Use setInterval instead of requestAnimationFrame
    // so analysis continues when the tab is in background
    analyseTimerId = setInterval(analyseLoop, ANALYSE_INTERVAL_MS);

    // Start observing user mute actions
    startMuteObserver();
  } catch (err) {
    const error = err as DOMException;
    let errorMsg: string;

    if (error.name === "NotAllowedError") {
      errorMsg = "mic_permission_denied";
      warn("マイクの権限が拒否されました。ブラウザの設定を確認してください。");
    } else if (error.name === "NotFoundError") {
      errorMsg = "mic_not_found";
      warn("マイクデバイスが見つかりません。");
    } else if (error.name === "NotReadableError") {
      errorMsg = "mic_in_use";
      warn("マイクが他のアプリケーションで使用中です。");
    } else if (error.name === "OverconstrainedError") {
      errorMsg = "mic_not_found";
      warn("指定されたマイクが見つかりません。デフォルトマイクで再試行します。");
      // Retry without specific deviceId
      selectedMicDeviceId = null;
      void chrome.storage.local.set({ [STORAGE_KEYS.micDeviceId]: "" });
      isStarting = false;
      scheduleStartListening();
      return;
    } else {
      errorMsg = "mic_unknown_error";
      warn("マイクの取得に失敗:", error.name, error.message);
    }

    isListening = false;
    currentState = State.ERROR;
    persistErrorState(errorMsg);
  } finally {
    isStarting = false;
  }
}

function stopListening() {
  listeningRunId++;
  isStarting = false;
  isListening = false;
  clearStartupTimer();
  clearGraceTimer();
  clearEnsureMuteTimers();
  stopMuteObserver();
  pttKeyHeld = false;
  shortcutUnmuteUntil = 0;

  if (analyseTimerId) {
    analyseTimerId = clearIntervalTimer(analyseTimerId);
  }

  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }

  if (audioContext) {
    void audioContext.close();
    audioContext = null;
  }

  analyser = null;
  dataArray = null;
  freqData = null;
  cachedMuteButton = null;
  voiceStartBin = 0;
  voiceEndBin = 0;
  currentState = State.IDLE;
  log("マイク監視を停止しました");
  persistIdleSnapshot();
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes[STORAGE_KEYS.config]) {
    perModeConfig = migrateConfig(changes[STORAGE_KEYS.config].newValue);
    config = getConfigForMode(perModeConfig, selectedMode);
    log("設定を更新:", config);
  }

  if (changes[STORAGE_KEYS.mode]) {
    const rawMode = changes[STORAGE_KEYS.mode].newValue;
    const newMode = normalizeMode(rawMode);
    if (rawMode !== undefined && rawMode !== newMode) {
      void chrome.storage.local.set({ [STORAGE_KEYS.mode]: newMode });
    }
    if (newMode !== selectedMode) {
      selectedMode = newMode;
      config = getConfigForMode(perModeConfig, newMode);
      if (isModeActive(newMode)) {
        lastActiveMode = newMode;
      }
      pttKeyHeld = false;
      log("モードを変更:", selectedMode, "config:", config);
      if (!isModeActive(newMode)) {
        stopListening();
      } else if (!isListening && !isStarting) {
        scheduleStartListening();
      }
    }
  }

  if (changes[STORAGE_KEYS.shortcutKey]) {
    shortcutKey = (changes[STORAGE_KEYS.shortcutKey].newValue as string) || DEFAULT_SHORTCUT;
    log("shortcut key changed:", shortcutKey);
  }

  if (changes[STORAGE_KEYS.micToggleAction]) {
    const action = getRequestedMicToggleAction(changes[STORAGE_KEYS.micToggleAction].newValue);
    if (action) {
      // Clear the action immediately so it can be triggered again
      void chrome.storage.local.set({ [STORAGE_KEYS.micToggleAction]: "" });

      // Same logic as handleShortcutKeyDown but without keyboard event
      if (!isModeActive(selectedMode) || !isListening) {
        // Re-enable last active mode (same as shortcut in Off mode)
        const modeToRestore = lastActiveMode;
        selectedMode = modeToRestore;
        void chrome.storage.local.set({ [STORAGE_KEYS.mode]: modeToRestore });
        scheduleStartListening();
      } else if (action === "unmute") {
        shortcutUnmuteUntil = Date.now() + config.gracePeriod;
        transition(State.UNMUTING);
      } else if (action === "mute") {
        transition(State.MUTED);
      } else if (action === "toggle") {
        const muted = isMeetMuted();
        if (muted === true || currentState === State.MUTED) {
          shortcutUnmuteUntil = Date.now() + config.gracePeriod;
          transition(State.UNMUTING);
        } else if (
          muted === false ||
          currentState === State.SPEAKING ||
          currentState === State.GRACE
        ) {
          transition(State.MUTED);
        }
      }
    }
  }

  if (changes[STORAGE_KEYS.micDeviceId]) {
    const newId = (changes[STORAGE_KEYS.micDeviceId].newValue as string) || null;
    if (newId !== selectedMicDeviceId) {
      selectedMicDeviceId = newId;
      log("マイクデバイスを変更:", selectedMicDeviceId ?? "default");
      if (isModeActive(selectedMode) && (isListening || isStarting)) {
        stopListening();
        scheduleStartListening();
      }
    }
  }
});

chrome.storage.local.get(
  [STORAGE_KEYS.config, STORAGE_KEYS.micDeviceId, STORAGE_KEYS.mode, STORAGE_KEYS.shortcutKey],
  (result) => {
    selectedMode = normalizeMode(result[STORAGE_KEYS.mode]);
    if (isModeActive(selectedMode)) {
      lastActiveMode = selectedMode;
    }
    if (result[STORAGE_KEYS.mode] === undefined || result[STORAGE_KEYS.mode] !== selectedMode) {
      void chrome.storage.local.set({ [STORAGE_KEYS.mode]: selectedMode });
    }
    shortcutKey = (result[STORAGE_KEYS.shortcutKey] as string) || DEFAULT_SHORTCUT;
    perModeConfig = migrateConfig(result[STORAGE_KEYS.config]);
    if (!isPerModeConfig(result[STORAGE_KEYS.config])) {
      void chrome.storage.local.set({ [STORAGE_KEYS.config]: perModeConfig });
    }
    config = getConfigForMode(perModeConfig, selectedMode);
    selectedMicDeviceId = (result[STORAGE_KEYS.micDeviceId] as string) || null;
    if (isModeActive(selectedMode)) {
      scheduleStartListening(2000);
    }
    // Always register the shortcut listener so it works even in Off mode
    startShortcutListener();
  },
);

// Clean up when the Meet tab is closed or navigated away
window.addEventListener("beforeunload", () => {
  if (isListening || isStarting) {
    stopListening();
  }
});

log("Hush Meet content script loaded");
