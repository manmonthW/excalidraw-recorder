import { useCallback, useRef, useState } from "react";
import { createDefaultKeyframe, type ZoomKeyframe } from "@/lib/motionEngine";

interface MotionTrackProps {
  durationSec: number;
  keyframes: ZoomKeyframe[];
  selectedId: string | null;
  pxPerSec: number;
  onKeyframesChange: (keyframes: ZoomKeyframe[]) => void;
  onSelect: (id: string | null) => void;
}

type DragMode = "move" | "resize-left" | "resize-right";

export function MotionTrack({
  durationSec,
  keyframes,
  selectedId,
  pxPerSec,
  onKeyframesChange,
  onSelect,
}: MotionTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: DragMode;
    kfId: string;
    startX: number;
    origStart: number;
    origEnd: number;
  } | null>(null);

  const [showMenu, setShowMenu] = useState<{ x: number; atSec: number } | null>(null);

  const secToX = (sec: number) => sec * pxPerSec;

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return; // clicked on a keyframe block
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const atSec = Math.max(0, Math.min(x / pxPerSec, durationSec));
    setShowMenu({ x, atSec });
    onSelect(null);
  };

  const handleAddZoom = () => {
    if (!showMenu) return;
    const duration = Math.min(3, durationSec - showMenu.atSec);
    if (duration <= 0) return;
    const kf = createDefaultKeyframe(showMenu.atSec, duration);
    onKeyframesChange([...keyframes, kf]);
    onSelect(kf.id);
    setShowMenu(null);
  };

  const handleBlockMouseDown = useCallback(
    (e: React.MouseEvent, kfId: string, mode: DragMode) => {
      e.stopPropagation();
      e.preventDefault();
      const kf = keyframes.find((k) => k.id === kfId);
      if (!kf) return;
      onSelect(kfId);
      setShowMenu(null);

      dragRef.current = {
        mode,
        kfId,
        startX: e.clientX,
        origStart: kf.startSec,
        origEnd: kf.endSec,
      };

      const handleMouseMove = (ev: MouseEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const dx = ev.clientX - drag.startX;
        const dtSec = dx / pxPerSec;

        onKeyframesChange(
          keyframes.map((k) => {
            if (k.id !== drag.kfId) return k;
            const updated = { ...k };

            if (drag.mode === "move") {
              let newStart = drag.origStart + dtSec;
              let newEnd = drag.origEnd + dtSec;
              const dur = newEnd - newStart;
              if (newStart < 0) { newStart = 0; newEnd = dur; }
              if (newEnd > durationSec) { newEnd = durationSec; newStart = durationSec - dur; }
              updated.startSec = Math.max(0, newStart);
              updated.endSec = Math.min(durationSec, newEnd);
            } else if (drag.mode === "resize-left") {
              updated.startSec = Math.max(0, Math.min(drag.origStart + dtSec, drag.origEnd - 0.3));
            } else if (drag.mode === "resize-right") {
              updated.endSec = Math.min(durationSec, Math.max(drag.origEnd + dtSec, drag.origStart + 0.3));
            }

            return updated;
          }),
        );
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [keyframes, pxPerSec, durationSec, onKeyframesChange, onSelect],
  );

  return (
    <div ref={trackRef} style={styles.track} onClick={handleTrackClick}>
      {/* Keyframe blocks */}
      {keyframes.map((kf) => {
        const left = secToX(kf.startSec);
        const width = secToX(kf.endSec - kf.startSec);
        const isSelected = kf.id === selectedId;

        return (
          <div
            key={kf.id}
            style={{
              ...styles.block,
              left,
              width,
              background: isSelected
                ? "linear-gradient(90deg, #7c3aed, #6d28d9)"
                : "linear-gradient(90deg, #3b82f6, #2563eb)",
              border: isSelected ? "1px solid #a78bfa" : "1px solid transparent",
            }}
            onMouseDown={(e) => handleBlockMouseDown(e, kf.id, "move")}
          >
            {/* Left resize handle */}
            <div
              style={styles.handleLeft}
              onMouseDown={(e) => handleBlockMouseDown(e, kf.id, "resize-left")}
            />
            {/* Label */}
            <span style={styles.blockLabel}>{kf.scale}×</span>
            {/* Right resize handle */}
            <div
              style={styles.handleRight}
              onMouseDown={(e) => handleBlockMouseDown(e, kf.id, "resize-right")}
            />
          </div>
        );
      })}

      {/* Empty state */}
      {keyframes.length === 0 && (
        <div style={styles.emptyHint}>Click to add motion</div>
      )}

      {/* Context menu */}
      {showMenu && (
        <div style={{ ...styles.menu, left: showMenu.x }}>
          <button style={styles.menuBtn} onClick={handleAddZoom}>
            🔍 2D Zoom
          </button>
          <button
            style={styles.menuBtn}
            onClick={() => setShowMenu(null)}
          >
            ✕ Cancel
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  track: {
    position: "relative",
    height: "100%",
    cursor: "pointer",
    minHeight: 32,
  },
  block: {
    position: "absolute",
    top: 4,
    height: 24,
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "grab",
    overflow: "hidden",
    minWidth: 20,
  },
  blockLabel: {
    fontSize: 11,
    color: "#fff",
    fontWeight: 600,
    pointerEvents: "none",
    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
  },
  handleLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    cursor: "ew-resize",
    background: "rgba(255,255,255,0.15)",
    borderRadius: "4px 0 0 4px",
  },
  handleRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 6,
    cursor: "ew-resize",
    background: "rgba(255,255,255,0.15)",
    borderRadius: "0 4px 4px 0",
  },
  emptyHint: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    color: "#585b70",
    pointerEvents: "none",
  },
  menu: {
    position: "absolute",
    top: -60,
    transform: "translateX(-50%)",
    background: "#313244",
    borderRadius: 8,
    padding: 4,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    zIndex: 20,
    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
  },
  menuBtn: {
    background: "none",
    border: "none",
    color: "#cdd6f4",
    fontSize: 12,
    padding: "6px 12px",
    cursor: "pointer",
    borderRadius: 4,
    textAlign: "left",
    whiteSpace: "nowrap",
  },
};
