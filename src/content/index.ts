/**
 * Hush Meet - Content Script
 * Google Meet の自動ミュート制御
 */

import { DEFAULT_CONFIG, SILENCE_RATIO, STORAGE_KEYS } from "../constants";

const State = {
  IDLE: "IDLE",
  MUTED: "MUTED",
  UNMUTING: "UNMUTING",
  SPEAKING: "SPEAKING",
  GRACE: "GRACE",
} as const;

type StateType = (typeof State)[keyof typeof State];

let currentState: StateType = State.IDLE;
let enabled = false;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let micStream: MediaStream | null = null;
let animFrameId: number | null = null;
let graceTimer: ReturnType<typeof setTimeout> | null = null;

let config = { ...DEFAULT_CONFIG };

const log = (msg: string, ...args: unknown[]) =>
  console.log(`[HushMeet] ${msg}`, ...args);
const warn = (msg: string, ...args: unknown[]) =>
  console.warn(`[HushMeet] ${msg}`, ...args);

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
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "d",
        code: "KeyD",
        ctrlKey: true,
        bubbles: true,
      }),
    );
    return;
  }

  if (currentlyMuted === shouldMute) return;

  const btn = findMuteButton();
  if (btn) {
    btn.click();
    log(shouldMute ? "ミュートしました" : "ミュート解除しました");
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

  chrome.storage.local.set({ [STORAGE_KEYS.state]: newState });
}

function analyseLoop() {
  if (!enabled || !analyser) return;

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
  }

  // Spectrum data for equalizer (16 bands)
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(freqData);
  const bandCount = 16;
  const bandSize = Math.floor(freqData.length / bandCount);
  const spectrum: number[] = [];
  for (let b = 0; b < bandCount; b++) {
    let bandSum = 0;
    for (let i = b * bandSize; i < (b + 1) * bandSize; i++) {
      bandSum += freqData[i];
    }
    spectrum.push(bandSum / bandSize / 255);
  }

  chrome.storage.local.set({
    [STORAGE_KEYS.level]: rms,
    [STORAGE_KEYS.spectrum]: spectrum,
  });
  animFrameId = requestAnimationFrame(analyseLoop);
}

async function startListening() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: true,
      },
    });

    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(micStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.3;
    source.connect(analyser);

    log("マイク監視を開始しました");
    transition(State.MUTED);
    analyseLoop();
  } catch (err) {
    warn("マイクの取得に失敗:", err);
    enabled = false;
  }
}

function stopListening() {
  enabled = false;
  clearGraceTimer();

  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  analyser = null;
  currentState = State.IDLE;
  log("マイク監視を停止しました");
  chrome.storage.local.set({
    [STORAGE_KEYS.state]: State.IDLE,
    [STORAGE_KEYS.level]: 0,
  });
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes[STORAGE_KEYS.enabled]) {
    const newVal = changes[STORAGE_KEYS.enabled].newValue;
    if (newVal && !enabled) {
      enabled = true;
      startListening();
    } else if (!newVal && enabled) {
      stopListening();
    }
  }

  if (changes[STORAGE_KEYS.config]) {
    const newConfig = changes[STORAGE_KEYS.config].newValue;
    config = {
      speechThreshold: newConfig.speechThreshold ?? DEFAULT_CONFIG.speechThreshold,
      silenceThreshold: (newConfig.speechThreshold ?? DEFAULT_CONFIG.speechThreshold) * SILENCE_RATIO,
      gracePeriod: newConfig.gracePeriod ?? DEFAULT_CONFIG.gracePeriod,
    };
    log("設定を更新:", config);
  }
});

chrome.storage.local.get(
  [STORAGE_KEYS.enabled, STORAGE_KEYS.config],
  (result) => {
    if (result[STORAGE_KEYS.config]) {
      const saved = result[STORAGE_KEYS.config];
      config = {
        speechThreshold: saved.speechThreshold ?? DEFAULT_CONFIG.speechThreshold,
        silenceThreshold: (saved.speechThreshold ?? DEFAULT_CONFIG.speechThreshold) * SILENCE_RATIO,
        gracePeriod: saved.gracePeriod ?? DEFAULT_CONFIG.gracePeriod,
      };
    }
    if (result[STORAGE_KEYS.enabled]) {
      enabled = true;
      setTimeout(startListening, 2000);
    }
  },
);

log("Hush Meet content script loaded");
