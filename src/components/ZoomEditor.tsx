import type { ZoomKeyframe } from "@/lib/motionEngine";

interface ZoomEditorProps {
  keyframe: ZoomKeyframe;
  onChange: (updated: ZoomKeyframe) => void;
  onDelete: () => void;
}

export function ZoomEditor({ keyframe, onChange, onDelete }: ZoomEditorProps) {
  const update = (patch: Partial<ZoomKeyframe>) => {
    onChange({ ...keyframe, ...patch });
  };

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.title}>🔍 Zoom Settings</span>
        <button onClick={onDelete} style={styles.deleteBtn} title="Delete keyframe">
          🗑
        </button>
      </div>

      <div style={styles.row}>
        <label style={styles.label}>Scale</label>
        <input
          type="range"
          min={1.2}
          max={4}
          step={0.1}
          value={keyframe.scale}
          onChange={(e) => update({ scale: parseFloat(e.target.value) })}
          style={styles.slider}
        />
        <span style={styles.value}>{keyframe.scale.toFixed(1)}×</span>
      </div>

      <div style={styles.row}>
        <label style={styles.label}>Ease In</label>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={keyframe.easeInSec}
          onChange={(e) => update({ easeInSec: parseFloat(e.target.value) })}
          style={styles.slider}
        />
        <span style={styles.value}>{keyframe.easeInSec.toFixed(1)}s</span>
      </div>

      <div style={styles.row}>
        <label style={styles.label}>Ease Out</label>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={keyframe.easeOutSec}
          onChange={(e) => update({ easeOutSec: parseFloat(e.target.value) })}
          style={styles.slider}
        />
        <span style={styles.value}>{keyframe.easeOutSec.toFixed(1)}s</span>
      </div>

      <div style={styles.row}>
        <label style={styles.label}>Center</label>
        <span style={styles.hint}>
          ({(keyframe.centerX * 100).toFixed(0)}%, {(keyframe.centerY * 100).toFixed(0)}%)
          — Click video to set
        </span>
      </div>

      <div style={styles.row}>
        <label style={styles.label}>Time</label>
        <span style={styles.hint}>
          {keyframe.startSec.toFixed(1)}s – {keyframe.endSec.toFixed(1)}s
          ({(keyframe.endSec - keyframe.startSec).toFixed(1)}s)
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    padding: "8px 16px 12px",
    borderTop: "1px solid #313244",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: "#cdd6f4",
  },
  deleteBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    padding: "2px 6px",
    borderRadius: 4,
    color: "#f38ba8",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  label: {
    fontSize: 11,
    color: "#a6adc8",
    width: 55,
    flexShrink: 0,
  },
  slider: {
    flex: 1,
    accentColor: "#7c3aed",
    cursor: "pointer",
    height: 4,
  },
  value: {
    fontSize: 12,
    color: "#cdd6f4",
    width: 40,
    textAlign: "right",
    fontFamily: "'JetBrains Mono', monospace",
  },
  hint: {
    fontSize: 11,
    color: "#6c7086",
  },
};
