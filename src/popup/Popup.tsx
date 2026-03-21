import { useEffect, useState } from "react";

interface HushMeetConfig {
  speechThreshold?: number;
  silenceThreshold?: number;
  gracePeriod?: number;
}

interface HushMeetStorage {
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
  const [threshold, setThreshold] = useState(0.025);
  const [gracePeriod, setGracePeriod] = useState(1500);

  useEffect(() => {
    chrome.storage.local.get(
      ["hushMeetEnabled", "hushMeetConfig", "hushMeetState", "hushMeetLevel"],
      (result: HushMeetStorage) => {
        setEnabled(!!result.hushMeetEnabled);
        if (result.hushMeetConfig) {
          setThreshold(result.hushMeetConfig.speechThreshold ?? 0.025);
          setGracePeriod(result.hushMeetConfig.gracePeriod ?? 1500);
        }
        setState(result.hushMeetState ?? "IDLE");
        setLevel(result.hushMeetLevel ?? 0);
      },
    );

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.hushMeetState) setState(changes.hushMeetState.newValue as string);
      if (changes.hushMeetLevel) setLevel((changes.hushMeetLevel.newValue as number) ?? 0);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    chrome.storage.local.set({ hushMeetEnabled: checked });
  };

  const handleThresholdChange = (val: number) => {
    setThreshold(val);
    chrome.storage.local.set({
      hushMeetConfig: {
        speechThreshold: val,
        silenceThreshold: val * 0.5,
        gracePeriod,
      },
    });
  };

  const handleGraceChange = (val: number) => {
    setGracePeriod(val);
    chrome.storage.local.set({
      hushMeetConfig: {
        speechThreshold: threshold,
        silenceThreshold: threshold * 0.5,
        gracePeriod: val,
      },
    });
  };

  const stateInfo = stateLabels[state] ?? stateLabels.IDLE;
  const levelPct = Math.min(100, (level / 0.1) * 100);
  const thresholdPct = Math.min(100, (threshold / 0.1) * 100);

  return (
    <div className="popup">
      <div className="header">
        <h1>Hush Meet</h1>
        <span className="version">v0.1.0</span>
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
            min="0.005"
            max="0.05"
            step="0.001"
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
            min="500"
            max="4000"
            step="100"
            value={gracePeriod}
            onChange={(e) => handleGraceChange(parseInt(e.target.value))}
          />
        </div>
      </div>

      <div className="footer">Google Meet タブで有効になります</div>
    </div>
  );
}
