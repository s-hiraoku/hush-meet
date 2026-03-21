import { useEffect, useState } from "react";
import {
  DEFAULT_CONFIG,
  THRESHOLD_RANGE,
  GRACE_RANGE,
  SILENCE_RATIO,
  STORAGE_KEYS,
  APP_VERSION,
} from "../constants";

interface HushMeetConfig {
  speechThreshold?: number;
  silenceThreshold?: number;
  gracePeriod?: number;
}

interface HushMeetStorage {
  [key: string]: boolean | HushMeetConfig | string | number | undefined;
  hushMeetEnabled?: boolean;
  hushMeetConfig?: HushMeetConfig;
  hushMeetState?: string;
  hushMeetLevel?: number;
}

const stateLabels: Record<string, { text: string; css: string }> = {
  IDLE: { text: "無効", css: "" },
  MUTED: { text: "ミュート中（待機）", css: "muted" },
  UNMUTING: { text: "ミュート解除中…", css: "speaking" },
  SPEAKING: { text: "発話中", css: "speaking" },
  GRACE: { text: "猶予中…", css: "grace" },
};

export function Popup() {
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState("IDLE");
  const [level, setLevel] = useState(0);
  const [threshold, setThreshold] = useState(DEFAULT_CONFIG.speechThreshold);
  const [gracePeriod, setGracePeriod] = useState(DEFAULT_CONFIG.gracePeriod);

  useEffect(() => {
    chrome.storage.local.get(
      [STORAGE_KEYS.enabled, STORAGE_KEYS.config, STORAGE_KEYS.state, STORAGE_KEYS.level],
      (result: HushMeetStorage) => {
        setEnabled(!!result.hushMeetEnabled);
        if (result.hushMeetConfig) {
          setThreshold(result.hushMeetConfig.speechThreshold ?? DEFAULT_CONFIG.speechThreshold);
          setGracePeriod(result.hushMeetConfig.gracePeriod ?? DEFAULT_CONFIG.gracePeriod);
        }
        setState(result.hushMeetState ?? "IDLE");
        setLevel(result.hushMeetLevel ?? 0);
      },
    );

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[STORAGE_KEYS.state]) setState(changes[STORAGE_KEYS.state].newValue as string);
      if (changes[STORAGE_KEYS.level]) setLevel((changes[STORAGE_KEYS.level].newValue as number) ?? 0);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const saveConfig = (speech: number, grace: number) => {
    chrome.storage.local.set({
      [STORAGE_KEYS.config]: {
        speechThreshold: speech,
        silenceThreshold: speech * SILENCE_RATIO,
        gracePeriod: grace,
      },
    });
  };

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    chrome.storage.local.set({ [STORAGE_KEYS.enabled]: checked });
  };

  const handleThresholdChange = (val: number) => {
    setThreshold(val);
    saveConfig(val, gracePeriod);
  };

  const handleGraceChange = (val: number) => {
    setGracePeriod(val);
    saveConfig(threshold, val);
  };

  const stateInfo = stateLabels[state] ?? stateLabels.IDLE;
  const levelPct = Math.min(100, (level / THRESHOLD_RANGE.max) * 100);
  const thresholdPct = Math.min(100, (threshold / THRESHOLD_RANGE.max) * 100);

  return (
    <div className="popup">
      <div className="header">
        <h1>Hush Meet</h1>
        <span className="version">v{APP_VERSION}</span>
      </div>

      <div className="toggle-row">
        <span className="toggle-label">自動ミュート</span>
        <label className="toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => handleToggle(e.target.checked)}
          />
          <span className="slider" />
        </label>
      </div>

      <div className="status">
        <span className={`status-dot ${stateInfo.css}`} />
        <span className="status-text">{stateInfo.text}</span>
      </div>

      <div className="meter">
        <div className="meter-label">マイク入力レベル</div>
        <div className="meter-bar-bg">
          <div
            className={`meter-bar ${level > threshold ? "hot" : ""}`}
            style={{ width: `${levelPct}%` }}
          />
          <div className="threshold-marker" style={{ left: `${thresholdPct}%` }} />
        </div>
      </div>

      <div className="settings">
        <div className="setting">
          <div className="setting-header">
            <span className="setting-label">発話検出の感度</span>
            <span className="setting-value">{threshold.toFixed(3)}</span>
          </div>
          <input
            type="range"
            min={THRESHOLD_RANGE.min}
            max={THRESHOLD_RANGE.max}
            step={THRESHOLD_RANGE.step}
            value={threshold}
            onChange={(e) => handleThresholdChange(parseFloat(e.target.value))}
          />
        </div>

        <div className="setting">
          <div className="setting-header">
            <span className="setting-label">猶予時間（発話後ミュートまで）</span>
            <span className="setting-value">{(gracePeriod / 1000).toFixed(1)}秒</span>
          </div>
          <input
            type="range"
            min={GRACE_RANGE.min}
            max={GRACE_RANGE.max}
            step={GRACE_RANGE.step}
            value={gracePeriod}
            onChange={(e) => handleGraceChange(parseInt(e.target.value))}
          />
        </div>
      </div>

      <div className="footer">Google Meet タブで有効になります</div>
    </div>
  );
}
