import { MODES, type ModeId } from "./constants.ts";
import { isModeActive } from "./mode-control.ts";

type ShortcutMatchEvent = Pick<
  KeyboardEvent,
  "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
>;

type ShortcutKeyDownEvent = ShortcutMatchEvent & Pick<KeyboardEvent, "repeat">;

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
  if (!isModeActive(mode) || event.repeat) return false;
  if (mode === MODES.pushToTalk && pttKeyHeld) return false;
  return true;
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
  if (!enabled || !isModeActive(mode) || mode !== MODES.pushToTalk || !pttKeyHeld) {
    return false;
  }
  return matchesShortcut(event, shortcut);
}
