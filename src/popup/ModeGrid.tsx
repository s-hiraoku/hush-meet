import { MODES, type ModeId } from "../constants";
import { t } from "../i18n.ts";

const MODE_LIST = [
  { id: MODES.off, key: "modeOff", icon: "\u23FB" },
  { id: MODES.auto, key: "modeAuto", icon: "A" },
  { id: MODES.autoOff, key: "modeAutoOff", icon: "AO" },
  { id: MODES.pushToTalk, key: "modePushToTalk", icon: "PTT" },
] as const;

export function ModeGrid({
  isLoaded,
  mode,
  onSelect,
}: {
  isLoaded: boolean;
  mode: ModeId;
  onSelect: (mode: ModeId) => void;
}) {
  return (
    <div className="mode-grid">
      {MODE_LIST.map((m) => (
        <button
          key={m.id}
          className={`mode-card ${mode === m.id ? "active" : ""} ${m.id === MODES.off ? "mode-off" : ""}`}
          onClick={() => onSelect(m.id)}
          disabled={!isLoaded}
        >
          <span className="mode-icon">{m.icon}</span>
          <span className="mode-name">{t(m.key)}</span>
        </button>
      ))}
    </div>
  );
}
