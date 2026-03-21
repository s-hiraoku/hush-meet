import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "../constants";
import { t } from "../i18n";
import "./equalizer.css";

const BAND_COUNT = 16;
const SEGMENTS = 8;
const EMPTY_BANDS = new Array(BAND_COUNT).fill(0);

export function Equalizer() {
  const [bands, setBands] = useState<number[]>(EMPTY_BANDS);

  useEffect(() => {
    chrome.storage.local.get([STORAGE_KEYS.spectrum], (result) => {
      const data = result[STORAGE_KEYS.spectrum];
      if (Array.isArray(data) && data.length > 0) {
        setBands(data);
      } else {
        setBands(EMPTY_BANDS);
      }
    });

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[STORAGE_KEYS.spectrum]) {
        const data = changes[STORAGE_KEYS.spectrum].newValue;
        setBands(Array.isArray(data) && data.length > 0 ? data : EMPTY_BANDS);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return (
    <div className="equalizer">
      <div className="eq-label">{t("spectrum")}</div>
      <div className="eq-bars">
        {bands.map((value, i) => {
          const activeSegments = Math.round(value * SEGMENTS);
          return (
            <div className="eq-band" key={i}>
              {Array.from({ length: SEGMENTS }, (_, s) => {
                const segIndex = SEGMENTS - 1 - s;
                const isActive = segIndex < activeSegments;
                let color = "low";
                if (segIndex >= SEGMENTS - 2) color = "peak";
                else if (segIndex >= SEGMENTS - 4) color = "mid";
                return <div key={s} className={`eq-seg ${isActive ? `active ${color}` : ""}`} />;
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
