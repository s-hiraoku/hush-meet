import { useState, useEffect, useRef } from "react";
import { THEME_LIST, STORAGE_KEYS, type ThemeId } from "../constants";
import { t } from "../i18n";

interface Props {
  current: ThemeId;
  onChange: (theme: ThemeId) => void;
}

const SWATCHES: Record<string, string> = {
  default: "linear-gradient(135deg, #1a1a2e, #e94560)",
  "analog-radio": "linear-gradient(135deg, #3a2816, #e8c97a)",
  boombox: "linear-gradient(135deg, #2a2c32, #888c96)",
  "retro-future": "linear-gradient(135deg, #0a0a1e, #00ffaa)",
};

export function ThemeSwitcher({ current, onChange }: Props) {
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

  const handleSelect = (id: ThemeId) => {
    onChange(id);
    chrome.storage.local.set({ [STORAGE_KEYS.theme]: id });
    setOpen(false);
  };

  return (
    <div className="theme-switcher" ref={ref}>
      <button className="theme-btn" onClick={() => setOpen(!open)} title={t("themeSwitcher")}>
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10a2.5 2.5 0 0 0 2.5-2.5c0-.61-.23-1.21-.64-1.67A.528.528 0 0 1 14.24 17H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9zm-5.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
        </svg>
      </button>
      {open && (
        <div className="theme-dropdown">
          {THEME_LIST.map(({ id, label }) => (
            <button
              key={id}
              className={`theme-option ${id === current ? "active" : ""}`}
              onClick={() => handleSelect(id)}
            >
              <span className="theme-swatch" style={{ background: SWATCHES[id] }} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
