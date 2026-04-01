import { en, ja, type Messages } from "./messages.ts";
import { de, zh, ko, es, fr } from "./messages-extra.ts";

const bundles: Record<string, Messages> = { en, ja, de, zh, ko, es, fr };

let current: Messages = en;
let listeners: Array<() => void> = [];

export type LocaleId = "auto" | "en" | "ja" | "de" | "zh" | "ko" | "es" | "fr";

export function getLocale(): Messages {
  return current;
}

export function setLocale(locale: LocaleId) {
  if (locale === "auto") {
    const browserLang = chrome.i18n.getUILanguage().split("-")[0];
    current = bundles[browserLang] ?? en;
  } else {
    current = bundles[locale] ?? en;
  }
  for (const fn of listeners) fn();
}

export function onLocaleChange(fn: () => void) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((f) => f !== fn);
  };
}

export function t(key: string, ...substitutions: string[]): string {
  const entry = current[key];
  if (!entry) return key;
  let msg = entry.message;
  if (substitutions.length > 0 && entry.placeholders) {
    for (const [name, ph] of Object.entries(entry.placeholders)) {
      const idx = parseInt(ph.content.replace("$", "")) - 1;
      if (idx >= 0 && idx < substitutions.length) {
        msg = msg.replace(new RegExp(`\\$${name.toUpperCase()}\\$`, "g"), substitutions[idx]);
      }
    }
  }
  return msg;
}

// Initialize with browser language
setLocale("auto");
