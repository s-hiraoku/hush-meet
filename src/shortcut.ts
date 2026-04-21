import { MODES, type ModeId } from "./constants.ts";
import { isModeActive } from "./mode-control.ts";

type ShortcutMatchEvent = Pick<
  KeyboardEvent,
  "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
>;

type ShortcutKeyDownEvent = ShortcutMatchEvent & Pick<KeyboardEvent, "code" | "repeat">;

/**
 * Fixed mode shortcuts use `event.code` (physical key) instead of `event.key`
 * because Shift changes the key value on many layouts
 * (e.g. Shift+1 = "!" on US, Shift+0 = ")" etc.).
 */
const FIXED_MODE_SHORTCUTS = [
  { code: "Digit0", mode: MODES.off },
  { code: "Digit1", mode: MODES.auto },
  { code: "Digit2", mode: MODES.autoOff },
  { code: "Digit3", mode: MODES.pushToTalk },
] as const;

export function parseShortcut(shortcut: string) {
  const parts = shortcut.toLowerCase().split("+");
  return {
    ctrlKey: parts.includes("ctrl"),
    shiftKey: parts.includes("shift"),
    altKey: parts.includes("alt"),
    metaKey: parts.includes("meta") || parts.includes("cmd"),
    key: parts[parts.length - 1],
  };
}

let cachedShortcutStr = "";
let cachedParsed: ReturnType<typeof parseShortcut> | null = null;
function getCachedParsedShortcut(shortcut: string) {
  if (shortcut !== cachedShortcutStr) {
    cachedShortcutStr = shortcut;
    cachedParsed = parseShortcut(shortcut);
  }
  return cachedParsed!;
}

export function matchesShortcut(event: ShortcutMatchEvent, shortcut: string): boolean {
  const parsed = getCachedParsedShortcut(shortcut);
  return (
    event.ctrlKey === parsed.ctrlKey &&
    event.shiftKey === parsed.shiftKey &&
    event.altKey === parsed.altKey &&
    event.metaKey === parsed.metaKey &&
    event.key.toLowerCase() === parsed.key
  );
}

export function shouldHandleShortcutKeyDown({
  enabled,
  event,
  mode,
  pttKeyHeld,
  shortcut,
}: {
  enabled: boolean;
  event: ShortcutKeyDownEvent;
  mode: ModeId;
  pttKeyHeld: boolean;
  shortcut: string;
}): boolean {
  if (!enabled || !matchesShortcut(event, shortcut)) return false;
  if (event.repeat) return false;
  // Allow shortcut when mode is off (caller handles re-enabling)
  if (isModeActive(mode) && mode === MODES.pushToTalk && pttKeyHeld) return false;
  return true;
}

export function getFixedModeShortcutTarget(event: ShortcutKeyDownEvent): ModeId | null {
  if (event.repeat) return null;
  if (!event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey) return null;
  const match = FIXED_MODE_SHORTCUTS.find(({ code }) => event.code === code);
  return match?.mode ?? null;
}

export function shouldHandleShortcutKeyUp({
  enabled,
  event,
  mode,
  pttKeyHeld,
  shortcut,
}: {
  enabled: boolean;
  event: ShortcutMatchEvent;
  mode: ModeId;
  pttKeyHeld: boolean;
  shortcut: string;
}): boolean {
  if (!enabled || mode !== MODES.pushToTalk || !pttKeyHeld) {
    return false;
  }
  return matchesShortcut(event, shortcut);
}
