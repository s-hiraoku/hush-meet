import type { ModeId } from "../constants.ts";
import { shouldHandleShortcutKeyDown, shouldHandleShortcutKeyUp } from "../shortcut.ts";

export function consumeShortcutEvent(e: KeyboardEvent) {
  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === "function") {
    e.stopImmediatePropagation();
  }
}

export function shouldTriggerShortcutKeyDown(args: {
  isListening: boolean;
  mode: ModeId;
  pttKeyHeld: boolean;
  shortcut: string;
  event: KeyboardEvent;
}) {
  return shouldHandleShortcutKeyDown({
    enabled: true,
    event: args.event,
    mode: args.mode,
    pttKeyHeld: args.pttKeyHeld,
    shortcut: args.shortcut,
  });
}

export function shouldTriggerShortcutKeyUp(args: {
  isListening: boolean;
  mode: ModeId;
  pttKeyHeld: boolean;
  shortcut: string;
  event: KeyboardEvent;
}) {
  return shouldHandleShortcutKeyUp({
    enabled: true,
    event: args.event,
    mode: args.mode,
    pttKeyHeld: args.pttKeyHeld,
    shortcut: args.shortcut,
  });
}
