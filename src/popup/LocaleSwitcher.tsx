import { useState, useEffect, useRef } from "react";
import { STORAGE_KEYS } from "../constants.ts";
import { t, setLocale, type LocaleId } from "../i18n.ts";

const LOCALES: { id: LocaleId; key: string }[] = [
  { id: "auto", key: "localeAuto" },
  { id: "en", key: "localeEn" },
  { id: "ja", key: "localeJa" },
];

interface Props {
  current: LocaleId;
  onChange: (locale: LocaleId) => void;
}

export function LocaleSwitcher({ current, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (id: LocaleId) => {
    setLocale(id);
    onChange(id);
    chrome.storage.local.set({ [STORAGE_KEYS.locale]: id });
    setOpen(false);
  };

  return (
    <div className="theme-switcher" ref={ref}>
      <button className="theme-btn" onClick={() => setOpen(!open)} title={t("localeSwitcher")}>
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
        </svg>
      </button>
      {open && (
        <div className="theme-dropdown">
          {LOCALES.map(({ id, key }) => (
            <button
              key={id}
              className={`theme-option ${id === current ? "active" : ""}`}
              onClick={() => handleSelect(id)}
            >
              {t(key)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
