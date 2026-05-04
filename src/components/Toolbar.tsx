import {
  Circle,
  CircleStop,
  Download,
  Mic,
  MicOff,
  Monitor,
  Pause,
  Play,
  Scissors,
  Square,
  X,
} from "lucide-react";
import { formatTime } from "@/lib/videoUtils";
import type { RecordingMode, RecordingState } from "@/hooks/useRecorder";

interface ToolbarProps {
  recordingState: RecordingState;
  microphoneEnabled: boolean;
  hasRecording: boolean;
  onStartCanvas: () => void;
  onStartScreen: () => void;
  onStop: () => void;
  onPause: () => void;
  onCancel: () => void;
  onToggleMic: () => void;
  onTrim: () => void;
  onExport: (format: "webm" | "mp4") => void;
  onDiscard: () => void;
}

export function Toolbar({
  recordingState,
  microphoneEnabled,
  hasRecording,
  onStartCanvas,
  onStartScreen,
  onStop,
  onPause,
  onCancel,
  onToggleMic,
  onTrim,
  onExport,
  onDiscard,
}: ToolbarProps) {
  const { isRecording, isPaused, elapsedSeconds } = recordingState;

  return (
    <div style={styles.toolbar}>
      <div style={styles.left}>
        <span style={styles.logo}>⬡ IMS AI Studio Recorder</span>
      </div>

      <div style={styles.center}>
        {!isRecording && !hasRecording && (
          <>
            <button
              onClick={onToggleMic}
              style={{
                ...styles.iconBtn,
                color: microphoneEnabled ? "#22c55e" : "#94a3b8",
              }}
              title={microphoneEnabled ? "Mute microphone" : "Enable microphone"}
            >
              {microphoneEnabled ? <Mic size={18} /> : <MicOff size={18} />}
            </button>

            <button onClick={onStartCanvas} style={styles.recordBtn} title="Record whiteboard">
              <Circle size={16} fill="currentColor" />
              <span>Record Canvas</span>
            </button>

            <button onClick={onStartScreen} style={styles.screenBtn} title="Record screen">
              <Monitor size={16} />
              <span>Record Screen</span>
            </button>
          </>
        )}

        {isRecording && (
          <>
            <div style={styles.timer}>
              <div
                style={{
                  ...styles.recordingDot,
                  animationPlayState: isPaused ? "paused" : "running",
                }}
              />
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatTime(elapsedSeconds)}
              </span>
            </div>

            <button onClick={onPause} style={styles.iconBtn} title={isPaused ? "Resume" : "Pause"}>
              {isPaused ? <Play size={18} /> : <Pause size={18} />}
            </button>

            <button
              onClick={onStop}
              style={{ ...styles.iconBtn, color: "#ef4444" }}
              title="Stop recording"
            >
              <CircleStop size={18} />
            </button>

            <button
              onClick={onCancel}
              style={{ ...styles.iconBtn, color: "#94a3b8" }}
              title="Cancel recording"
            >
              <X size={18} />
            </button>
          </>
        )}

        {!isRecording && hasRecording && (
          <>
            <button onClick={onTrim} style={styles.actionBtn} title="Trim video">
              <Scissors size={16} />
              <span>Trim</span>
            </button>

            <button
              onClick={() => onExport("webm")}
              style={styles.exportBtn}
              title="Download as WebM"
            >
              <Download size={16} />
              <span>WebM</span>
            </button>

            <button
              onClick={() => onExport("mp4")}
              style={styles.exportBtn}
              title="Download as MP4"
            >
              <Download size={16} />
              <span>MP4</span>
            </button>

            <button
              onClick={onDiscard}
              style={{ ...styles.iconBtn, color: "#ef4444" }}
              title="Discard recording"
            >
              <Square size={16} />
              <span style={{ fontSize: 12, marginLeft: 4 }}>Discard</span>
            </button>
          </>
        )}
      </div>

      <div style={styles.right} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 48,
    padding: "0 16px",
    background: "#1e1e2e",
    borderBottom: "1px solid #313244",
    color: "#cdd6f4",
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 14,
    zIndex: 100,
    flexShrink: 0,
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 200,
  },
  logo: {
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: -0.3,
  },
  center: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  right: {
    minWidth: 200,
  },
  iconBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: "6px 10px",
    border: "none",
    borderRadius: 8,
    background: "transparent",
    color: "#cdd6f4",
    cursor: "pointer",
    fontSize: 13,
    transition: "background 0.15s",
  },
  recordBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 14px",
    border: "none",
    borderRadius: 8,
    background: "#ef4444",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  screenBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 14px",
    border: "none",
    borderRadius: 8,
    background: "#3b82f6",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  actionBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 14px",
    border: "1px solid #45475a",
    borderRadius: 8,
    background: "transparent",
    color: "#cdd6f4",
    cursor: "pointer",
    fontSize: 13,
  },
  exportBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 14px",
    border: "none",
    borderRadius: 8,
    background: "#22c55e",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  timer: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 12px",
    background: "#313244",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', monospace",
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#ef4444",
    animation: "pulse 1.2s ease-in-out infinite",
  },
};
