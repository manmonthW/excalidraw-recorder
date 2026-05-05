import { useCallback, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { ZoomKeyframe } from "@/lib/motionEngine";
import { MotionTrack } from "./MotionTrack";

interface TimelineProps {
  durationSec: number;
  currentTimeSec: number;
  trimStartSec: number;
  trimEndSec: number;
  keyframes: ZoomKeyframe[];
  selectedKeyframeId: string | null;
  onSeek: (timeSec: number) => void;
  onTrimChange: (startSec: number, endSec: number) => void;
  onKeyframesChange: (keyframes: ZoomKeyframe[]) => void;
  onSelectKeyframe: (id: string | null) => void;
}

const TRACK_HEIGHT = 32;
const RULER_HEIGHT = 24;
const PX_PER_SEC = 60; // pixels per second on timeline
const TRACK_LABEL_OFFSET = 72;

export function Timeline({
  durationSec,
  currentTimeSec,
  trimStartSec,
  trimEndSec,
  keyframes,
  selectedKeyframeId,
  onSeek,
  onTrimChange,
  onKeyframesChange,
  onSelectKeyframe,
}: TimelineProps) {
  const rulerRef = useRef<HTMLDivElement>(null);
  const [draggingTrim, setDraggingTrim] = useState<"start" | "end" | null>(null);

  const timeToX = useCallback(
    (sec: number) => sec * PX_PER_SEC,
    [],
  );

  const xToTime = useCallback(
    (x: number) => Math.max(0, Math.min(x / PX_PER_SEC, durationSec)),
    [durationSec],
  );

  const handleRulerClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (draggingTrim) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scrollLeft = e.currentTarget.parentElement?.scrollLeft ?? 0;
    const x = e.clientX - rect.left + scrollLeft;
    onSeek(xToTime(x));
  };

  const handleTrimDragStart = useCallback(
    (which: "start" | "end", e: ReactMouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setDraggingTrim(which);

      const handleMove = (ev: MouseEvent) => {
        const scrollArea = rulerRef.current?.parentElement;
        if (!scrollArea) return;
        const rect = scrollArea.getBoundingClientRect();
        const scrollLeft = scrollArea.scrollLeft;
        const x = ev.clientX - rect.left + scrollLeft - TRACK_LABEL_OFFSET;
        const sec = Math.max(0, Math.min(x / PX_PER_SEC, durationSec));
        if (which === "start") {
          onTrimChange(Math.min(sec, trimEndSec - 0.1), trimEndSec);
        } else {
          onTrimChange(trimStartSec, Math.max(sec, trimStartSec + 0.1));
        }
      };

      const handleUp = () => {
        setDraggingTrim(null);
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [durationSec, trimStartSec, trimEndSec, onTrimChange],
  );

  // Generate tick marks
  const ticks: { sec: number; label?: string }[] = [];
  for (let s = 0; s <= durationSec; s++) {
    ticks.push({ sec: s, label: s % 5 === 0 ? formatTimeMini(s) : undefined });
  }

  const totalWidth = Math.max(timeToX(durationSec), 300);
  const playheadX = timeToX(currentTimeSec) + TRACK_LABEL_OFFSET;

  return (
    <div style={styles.container}>
      {/* Scrollable area */}
      <div style={styles.scrollArea}>
        <div style={{ ...styles.inner, width: totalWidth }}>
          {/* Ruler */}
          <div
            ref={rulerRef}
            style={styles.ruler}
            onClick={handleRulerClick}
          >
            {ticks.map((tick) => (
              <div
                key={tick.sec}
                style={{
                  ...styles.tick,
                  left: timeToX(tick.sec),
                  height: tick.label ? 12 : 6,
                }}
              >
                {tick.label && (
                  <span style={styles.tickLabel}>{tick.label}</span>
                )}
              </div>
            ))}
          </div>

          {/* Screen track (simple colored bar) */}
          <div style={styles.trackRow}>
            <div style={styles.trackLabel}>Screen</div>
            <div style={styles.trackContent}>
              {/* Trim region overlay */}
              <div
                style={{
                  ...styles.trimDimLeft,
                  width: timeToX(trimStartSec),
                }}
              />
              <div
                style={{
                  ...styles.trimDimRight,
                  left: timeToX(trimEndSec),
                  width: timeToX(durationSec) - timeToX(trimEndSec),
                }}
              />
              {/* Screen bar */}
              <div
                style={{
                  ...styles.screenBar,
                  width: timeToX(durationSec),
                }}
              />
              {/* Trim handles */}
              <div
                style={{ ...styles.trimHandle, left: timeToX(trimStartSec) - 4 }}
                onMouseDown={(e) => handleTrimDragStart("start", e)}
                title="Trim start"
              >
                ◀
              </div>
              <div
                style={{ ...styles.trimHandle, left: timeToX(trimEndSec) - 4 }}
                onMouseDown={(e) => handleTrimDragStart("end", e)}
                title="Trim end"
              >
                ▶
              </div>
            </div>
          </div>

          {/* Motion track */}
          <div style={styles.trackRow}>
            <div style={styles.trackLabel}>Motion</div>
            <div style={styles.trackContent}>
              <MotionTrack
                durationSec={durationSec}
                keyframes={keyframes}
                selectedId={selectedKeyframeId}
                pxPerSec={PX_PER_SEC}
                onKeyframesChange={onKeyframesChange}
                onSelect={onSelectKeyframe}
              />
            </div>
          </div>

          {/* Playhead */}
          <div
            style={{
              ...styles.playhead,
              left: playheadX,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function formatTimeMini(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    borderTop: "1px solid #313244",
    background: "#181825",
    userSelect: "none",
  },
  scrollArea: {
    overflowX: "auto",
    overflowY: "hidden",
    position: "relative",
  },
  inner: {
    position: "relative",
    minHeight: RULER_HEIGHT + TRACK_HEIGHT * 2 + 8,
    paddingLeft: TRACK_LABEL_OFFSET,
  },
  ruler: {
    position: "relative",
    height: RULER_HEIGHT,
    borderBottom: "1px solid #313244",
    cursor: "pointer",
  },
  tick: {
    position: "absolute",
    bottom: 0,
    width: 1,
    background: "#585b70",
  },
  tickLabel: {
    position: "absolute",
    top: -14,
    left: 4,
    fontSize: 10,
    color: "#6c7086",
    fontFamily: "'JetBrains Mono', monospace",
    whiteSpace: "nowrap",
  },
  trackRow: {
    display: "flex",
    alignItems: "center",
    height: TRACK_HEIGHT,
    position: "relative",
  },
  trackLabel: {
    position: "absolute",
    left: -68,
    width: 60,
    fontSize: 11,
    color: "#a6adc8",
    textAlign: "right",
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  trackContent: {
    flex: 1,
    height: "100%",
    position: "relative",
  },
  screenBar: {
    height: 24,
    marginTop: 4,
    borderRadius: 4,
    background: "linear-gradient(90deg, #45475a 0%, #585b70 100%)",
  },
  trimDimLeft: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    background: "rgba(0,0,0,0.5)",
    borderRadius: "4px 0 0 4px",
    zIndex: 2,
    pointerEvents: "none",
  },
  trimDimRight: {
    position: "absolute",
    top: 0,
    height: "100%",
    background: "rgba(0,0,0,0.5)",
    borderRadius: "0 4px 4px 0",
    zIndex: 2,
    pointerEvents: "none",
  },
  trimHandle: {
    position: "absolute",
    top: 0,
    width: 10,
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "ew-resize",
    zIndex: 5,
    fontSize: 8,
    color: "#f9e2af",
    background: "rgba(249, 226, 175, 0.3)",
    borderRadius: 3,
    userSelect: "none",
  },
  playhead: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    background: "#ef4444",
    pointerEvents: "none",
    zIndex: 10,
    transition: "left 0.05s linear",
  },
};
