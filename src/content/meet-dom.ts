import { inferMeetMutedFromLabel, isMuteControlLabel } from "../meet-controls.ts";

export function findBottomToolbar(): HTMLElement | null {
  const toolbar = document.querySelector<HTMLElement>('[role="toolbar"]');
  if (toolbar) return toolbar;

  const bars = document.querySelectorAll<HTMLElement>("[jscontroller][jsaction] div[jscontroller]");
  for (const bar of bars) {
    const rect = bar.getBoundingClientRect();
    if (rect.bottom > window.innerHeight * 0.8 && rect.width > window.innerWidth * 0.5) {
      return bar;
    }
  }
  return null;
}

function toClickableControl(element: HTMLElement | null): HTMLElement | null {
  if (!element) return null;
  if (element.matches("button, [role='button']")) return element;
  return element.closest<HTMLElement>("button, [role='button']");
}

function getMuteControlLabel(element: HTMLElement | null): string {
  if (!element) return "";
  return (
    element.getAttribute("aria-label") ??
    element.getAttribute("data-tooltip") ??
    element.textContent ??
    ""
  ).toLowerCase();
}

function isParticipantControl(element: HTMLElement): boolean {
  return !!element.closest(
    '[data-participant-id], [data-requested-participant-id], [role="listitem"], [role="list"]',
  );
}

function safeQuerySelector<T extends Element>(
  root: ParentNode,
  selector: string,
  warn: (msg: string, ...args: unknown[]) => void,
): T | null {
  try {
    return root.querySelector<T>(selector);
  } catch (error) {
    warn("invalid selector:", selector, error);
    return null;
  }
}

function safeQuerySelectorAll<T extends Element>(
  root: ParentNode,
  selector: string,
  warn: (msg: string, ...args: unknown[]) => void,
): T[] {
  try {
    return Array.from(root.querySelectorAll<T>(selector));
  } catch (error) {
    warn("invalid selector:", selector, error);
    return [];
  }
}

export function findMuteButton(
  warn: (msg: string, ...args: unknown[]) => void,
): HTMLElement | null {
  const selectors = [
    'button[aria-label*="マイク"]',
    'button[aria-label*="microphone"]',
    'button[aria-label*="Microphone"]',
    'button[aria-label*="mute"]',
    'button[aria-label*="Mute"]',
    'button[aria-label*="ミュート"]',
    '[role="button"][aria-label*="microphone"]',
    '[role="button"][aria-label*="Microphone"]',
    '[role="button"][aria-label*="マイク"]',
    '[data-tooltip*="マイク"]',
    '[data-tooltip*="microphone"]',
    '[data-tooltip*="Microphone"]',
  ];

  const toolbar = findBottomToolbar();
  if (toolbar) {
    for (const sel of selectors) {
      const btn = toClickableControl(safeQuerySelector<HTMLElement>(toolbar, sel, warn));
      if (btn) return btn;
    }

    for (const candidate of safeQuerySelectorAll<HTMLElement>(
      toolbar,
      "button, [role='button']",
      warn,
    )) {
      if (isParticipantControl(candidate)) continue;
      if (isMuteControlLabel(getMuteControlLabel(candidate))) {
        return candidate;
      }
    }
  }

  for (const sel of selectors) {
    const candidates = safeQuerySelectorAll<HTMLElement>(document, sel, warn);
    for (const candidate of candidates) {
      const btn = toClickableControl(candidate);
      if (!btn || isParticipantControl(btn)) continue;
      return btn;
    }
  }
  return null;
}

export function inferMuteStateFromButton(button: HTMLElement | null): boolean | null {
  if (!button) return null;
  if (button.hasAttribute("data-is-muted")) {
    return button.getAttribute("data-is-muted") === "true";
  }
  if (button.hasAttribute("aria-pressed")) {
    return button.getAttribute("aria-pressed") === "false";
  }
  return inferMeetMutedFromLabel(getMuteControlLabel(button));
}
