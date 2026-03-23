/**
 * Hush Meet - Content Script
 * Google Meet の自動ミュート制御
 */

import { DEFAULT_CONFIG, SILENCE_RATIO, STORAGE_KEYS } from "../constants.ts";

const State = {
  IDLE: "IDLE",
  MUTED: "MUTED",
  UNMUTING: "UNMUTING",
  SPEAKING: "SPEAKING",
  GRACE: "GRACE",
  ERROR: "ERROR",
  USER_MUTED: "USER_MUTED",
} as const;

type StateType = (typeof State)[keyof typeof State];

let currentState: StateType = State.IDLE;
let enabled = false;
let starting = false;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let micStream: MediaStream | null = null;
let analyseTimerId: ReturnType<typeof setInterval> | null = null;
let graceTimer: ReturnType<typeof setTimeout> | null = null;
let muteObserver: MutationObserver | null = null;
let mutingByExtension = false;
let selectedMicDeviceId: string | null = null;

let config: { speechThreshold: number; silenceThreshold: number; gracePeriod: number } = {
  ...DEFAULT_CONFIG,
};

const log = (msg: string, ...args: unknown[]) => console.log(`[HushMeet] ${msg}`, ...args);
const warn = (msg: string, ...args: unknown[]) => console.warn(`[HushMeet] ${msg}`, ...args);

function findMuteButton(): HTMLElement | null {
  const selectors = [
    'button[aria-label*="マイク"]',
    'button[aria-label*="microphone" i]',
    'button[aria-label*="Mute" i]',
    'button[aria-label*="ミュート"]',
    '[data-tooltip*="マイク"]',
    '[data-tooltip*="microphone" i]',
  ];

  for (const sel of selectors) {
    const btn = document.querySelector<HTMLElement>(sel);
    if (btn) return btn;
  }
  return null;
}

function isMeetMuted(): boolean | null {
  const btn = findMuteButton();
  if (!btn) return null;

  if (btn.hasAttribute("data-is-muted")) {
    return btn.getAttribute("data-is-muted") === "true";
  }

  const label = (
    btn.getAttribute("aria-label") ??
    btn.getAttribute("data-tooltip") ??
    ""
  ).toLowerCase();

  if (
    label.includes("ミュートを解除") ||
    label.includes("unmute") ||
    label.includes("turn on microphone")
  ) {
    return true;
  }
  if (
    label.includes("ミュート") ||
    label.includes("mute") ||
    label.includes("turn off microphone")
  ) {
    return false;
  }

  return null;
}

function toggleMeetMute(shouldMute: boolean) {
  const currentlyMuted = isMeetMuted();

  if (currentlyMuted === null) {
    log("ミュートボタン未検出、Ctrl+D で試行");
    mutingByExtension = true;
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "d",
        code: "KeyD",
        ctrlKey: true,
        bubbles: true,
      }),
    );
    setTimeout(() => {
      mutingByExtension = false;
    }, 500);
    return;
  }

  if (currentlyMuted === shouldMute) return;

  const btn = findMuteButton();
  if (btn) {
    mutingByExtension = true;
    btn.click();
    log(shouldMute ? "ミュートしました" : "ミュート解除しました");
    setTimeout(() => {
      mutingByExtension = false;
    }, 500);
  }
}

function clearGraceTimer() {
  if (graceTimer) {
    clearTimeout(graceTimer);
    graceTimer = null;
  }
}

function transition(newState: StateType) {
  if (currentState === newState) return;
  const prev = currentState;
  currentState = newState;
  log(`状態遷移: ${prev} → ${newState}`);

  switch (newState) {
    case State.UNMUTING:
      toggleMeetMute(false);
      currentState = State.SPEAKING;
      break;

    case State.GRACE:
      clearGraceTimer();
      graceTimer = setTimeout(() => {
        if (currentState === State.GRACE) {
          transition(State.MUTED);
        }
      }, config.gracePeriod);
      break;

    case State.MUTED:
      clearGraceTimer();
      toggleMeetMute(true);
      break;

    case State.SPEAKING:
      clearGraceTimer();
      break;
  }

  void chrome.storage.local.set({ [STORAGE_KEYS.state]: newState });
}

// Watch for user-initiated mute changes on the Meet mute button
function startMuteObserver() {
  stopMuteObserver();

  const checkForUserMute = () => {
    if (mutingByExtension) return;
    if (currentState === State.IDLE || currentState === State.ERROR) return;

    const muted = isMeetMuted();
    if (muted === true && currentState !== State.MUTED && currentState !== State.USER_MUTED) {
      log("ユーザーが手動でミュートしました — 自動解除を一時停止");
      clearGraceTimer();
      currentState = State.USER_MUTED;
      void chrome.storage.local.set({ [STORAGE_KEYS.state]: State.USER_MUTED });
    } else if (muted === false && currentState === State.USER_MUTED) {
      log("ユーザーが手動でミュート解除しました — 自動制御を再開");
      transition(State.SPEAKING);
    }
  };

  const btn = findMuteButton();
  if (btn) {
    muteObserver = new MutationObserver(checkForUserMute);
    muteObserver.observe(btn, {
      attributes: true,
      attributeFilter: ["aria-label", "data-tooltip", "data-is-muted"],
    });
    log("ミュートボタン監視を開始");
  } else {
    // Button not found yet, retry periodically
    const retryId = setInterval(() => {
      const b = findMuteButton();
      if (b && enabled) {
        clearInterval(retryId);
        muteObserver = new MutationObserver(checkForUserMute);
        muteObserver.observe(b, {
          attributes: true,
          attributeFilter: ["aria-label", "data-tooltip", "data-is-muted"],
        });
        log("ミュートボタン監視を開始（リトライ）");
      }
    }, 2000);
    // Stop retrying after 30s
    setTimeout(() => clearInterval(retryId), 30000);
  }
}

function stopMuteObserver() {
  if (muteObserver) {
    muteObserver.disconnect();
    muteObserver = null;
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
  if (!enabled || !analyser || !audioContext) return;

  // Skip analysis if AudioContext is not running
  if (audioContext.state !== "running") {
    void ensureAudioContextRunning();
    return;
  }

  const dataArray = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(dataArray);

  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i] * dataArray[i];
  }
  const rms = Math.sqrt(sum / dataArray.length);

  switch (currentState) {
    case State.MUTED:
      if (rms > config.speechThreshold) {
        transition(State.UNMUTING);
      }
      break;

    case State.SPEAKING:
      if (rms < config.silenceThreshold) {
        transition(State.GRACE);
      }
      break;

    case State.GRACE:
      if (rms > config.silenceThreshold) {
        transition(State.SPEAKING);
      }
      break;

    case State.USER_MUTED:
      // Do nothing — user manually muted, wait for user to unmute
      break;
  }

  // Spectrum data for equalizer (16 bands)
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(freqData);
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

  void chrome.storage.local.set({
    [STORAGE_KEYS.level]: rms,
    [STORAGE_KEYS.spectrum]: spectrum,
  });
}

const ANALYSE_INTERVAL_MS = 50;

async function startListening() {
  if (starting) {
    log("startListening already in progress, skipping");
    return;
  }
  starting = true;

  try {
    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: false,
      autoGainControl: true,
    };

    if (selectedMicDeviceId) {
      audioConstraints.deviceId = { exact: selectedMicDeviceId };
    }

    micStream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
    });

    audioContext = new AudioContext();

    // Ensure AudioContext is running (may be suspended without user gesture)
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    // Listen for future suspend/resume events
    audioContext.addEventListener("statechange", () => {
      log(`AudioContext state changed: ${audioContext?.state}`);
      if (audioContext?.state === "suspended" && enabled) {
        void ensureAudioContextRunning();
      }
    });

    const source = audioContext.createMediaStreamSource(micStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.3;
    source.connect(analyser);

    enabled = true;
    log("マイク監視を開始しました");
    transition(State.MUTED);

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
      starting = false;
      void startListening();
      return;
    } else {
      errorMsg = "mic_unknown_error";
      warn("マイクの取得に失敗:", error.name, error.message);
    }

    enabled = false;
    currentState = State.ERROR;
    void chrome.storage.local.set({
      [STORAGE_KEYS.enabled]: false,
      [STORAGE_KEYS.state]: State.ERROR,
      [STORAGE_KEYS.error]: errorMsg,
    });
  } finally {
    starting = false;
  }
}

function stopListening() {
  enabled = false;
  clearGraceTimer();
  stopMuteObserver();

  if (analyseTimerId) {
    clearInterval(analyseTimerId);
    analyseTimerId = null;
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
  currentState = State.IDLE;
  log("マイク監視を停止しました");
  void chrome.storage.local.set({
    [STORAGE_KEYS.state]: State.IDLE,
    [STORAGE_KEYS.level]: 0,
    [STORAGE_KEYS.spectrum]: [],
  });
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes[STORAGE_KEYS.enabled]) {
    const newVal = changes[STORAGE_KEYS.enabled].newValue;
    if (newVal && !enabled && !starting) {
      void startListening();
    } else if (!newVal && enabled) {
      stopListening();
    }
  }

  // Handle "resume auto mute" from popup
  if (changes[STORAGE_KEYS.state]) {
    const newState = changes[STORAGE_KEYS.state].newValue as string;
    if (newState === State.MUTED && currentState === State.USER_MUTED) {
      log("ユーザーが自動ミュートを再開");
      currentState = State.MUTED;
    }
  }

  if (changes[STORAGE_KEYS.config]) {
    const newConfig = changes[STORAGE_KEYS.config].newValue as typeof config;
    config = {
      speechThreshold: newConfig.speechThreshold ?? DEFAULT_CONFIG.speechThreshold,
      silenceThreshold:
        (newConfig.speechThreshold ?? DEFAULT_CONFIG.speechThreshold) * SILENCE_RATIO,
      gracePeriod: newConfig.gracePeriod ?? DEFAULT_CONFIG.gracePeriod,
    };
    log("設定を更新:", config);
  }

  if (changes[STORAGE_KEYS.micDeviceId]) {
    const newId = (changes[STORAGE_KEYS.micDeviceId].newValue as string) || null;
    if (newId !== selectedMicDeviceId) {
      selectedMicDeviceId = newId;
      log("マイクデバイスを変更:", selectedMicDeviceId ?? "default");
      if (enabled) {
        stopListening();
        enabled = true;
        void startListening();
      }
    }
  }
});

chrome.storage.local.get(
  [STORAGE_KEYS.enabled, STORAGE_KEYS.config, STORAGE_KEYS.micDeviceId],
  (result) => {
    if (result[STORAGE_KEYS.config]) {
      const saved = result[STORAGE_KEYS.config] as typeof config;
      config = {
        speechThreshold: saved.speechThreshold ?? DEFAULT_CONFIG.speechThreshold,
        silenceThreshold: (saved.speechThreshold ?? DEFAULT_CONFIG.speechThreshold) * SILENCE_RATIO,
        gracePeriod: saved.gracePeriod ?? DEFAULT_CONFIG.gracePeriod,
      };
    }
    selectedMicDeviceId = (result[STORAGE_KEYS.micDeviceId] as string) || null;
    if (result[STORAGE_KEYS.enabled]) {
      setTimeout(() => void startListening(), 2000);
    }
  },
);

// Clean up when the Meet tab is closed or navigated away
window.addEventListener("beforeunload", () => {
  if (enabled) {
    stopListening();
  }
});

log("Hush Meet content script loaded");
