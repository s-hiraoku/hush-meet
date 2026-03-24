import { useState, useEffect, useRef } from "react";
import { t } from "../i18n.ts";

const GAMES = [{ id: "breakout", key: "gameBreakout", file: "games/breakout.html" }];

export function GameLauncher() {
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

  const handleSelect = (file: string) => {
    setOpen(false);
    chrome.windows.create({
      url: chrome.runtime.getURL(file),
      type: "popup",
      width: 480,
      height: 640,
    });
  };

  return (
    <div className="theme-switcher" ref={ref}>
      <button className="theme-btn" onClick={() => setOpen(!open)} title={t("gameLauncher")}>
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
        </svg>
      </button>
      {open && (
        <div className="theme-dropdown">
          {GAMES.map(({ id, key, file }) => (
            <button key={id} className="theme-option" onClick={() => handleSelect(file)}>
              {t(key)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
