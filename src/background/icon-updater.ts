import { MODES, STORAGE_KEYS, normalizeMode } from "../constants.ts";
import type { ModeId } from "../constants.ts";

/**
 * Mode-to-color mapping for the toolbar icon.
 * Each mode gets a distinct circle color; the "H" letter stays white.
 */
const MODE_COLORS: Record<ModeId, string> = {
  [MODES.off]: "#9e9e9e", // grey
  [MODES.auto]: "#4caf50", // green
  [MODES.autoOff]: "#ff9800", // amber/yellow
  [MODES.pushToTalk]: "#2196f3", // blue
};

const MODE_BADGE: Record<ModeId, { text: string; bg: string }> = {
  [MODES.off]: { text: "×", bg: "#9e9e9e" },
  [MODES.auto]: { text: "A", bg: "#4caf50" },
  [MODES.autoOff]: { text: "O", bg: "#ff9800" },
  [MODES.pushToTalk]: { text: "P", bg: "#2196f3" },
};

const SIZES = [16, 32, 48, 128] as const;

function drawIcon(size: number, color: string): ImageData {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d")!;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.5;

  // Circle background
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // "H" letter
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(size * 0.65)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("H", cx, cy + size * 0.02);

  return ctx.getImageData(0, 0, size, size);
}

function buildIconImageData(mode: ModeId): Record<number, ImageData> {
  const color = MODE_COLORS[mode] ?? MODE_COLORS[MODES.off];
  const imageData: Record<number, ImageData> = {};
  for (const size of SIZES) {
    imageData[size] = drawIcon(size, color);
  }
  return imageData;
}

export function updateIcon(mode: ModeId): void {
  const imageData = buildIconImageData(mode);
  const badge = MODE_BADGE[mode] ?? MODE_BADGE[MODES.off];
  void chrome.action.setIcon({ imageData });
  void chrome.action.setBadgeText({ text: badge.text });
  void chrome.action.setBadgeBackgroundColor({ color: badge.bg });
}

/** Set up storage listener to keep the icon in sync with the current mode. */
export function initIconUpdater(): void {
  // Set initial icon
  chrome.storage.local.get([STORAGE_KEYS.mode], (result) => {
    const mode = normalizeMode(result[STORAGE_KEYS.mode]);
    updateIcon(mode);
  });

  // Watch for mode changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[STORAGE_KEYS.mode]) {
      const mode = normalizeMode(changes[STORAGE_KEYS.mode].newValue);
      updateIcon(mode);
    }
  });
}
