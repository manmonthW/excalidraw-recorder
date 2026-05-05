import { useCallback, useEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/videoUtils";
import { getTransformAtTime, type ZoomKeyframe } from "@/lib/motionEngine";
import { Timeline } from "./Timeline";
import { ZoomEditor } from "./ZoomEditor";

interface EditSnapshot {
  keyframes: ZoomKeyframe[];
  trimStart: number;
  trimEnd: number;
  selectedId: string | null;
}

interface VideoPreviewProps {
  blob: Blob;
  onKeyframesChange: (keyframes: ZoomKeyframe[]) => void;
  onTrimChange: (startMs: number, endMs: number) => void;
  onExport: (format: "webm" | "mp4") => void;
  onDiscard: () => void;
  onClose: () => void;
}

export function VideoPreview({ blob, onKeyframesChange, onTrimChange, onExport, onDiscard, onClose }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [keyframes, setKeyframes] = useState<ZoomKeyframe[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [undoStack, setUndoStack] = useState<EditSnapshot[]>([]);

  // Sync keyframes to parent whenever they change
  useEffect(() => {
    onKeyframesChange(keyframes);
  }, [keyframes, onKeyframesChange]);

  const pushUndoSnapshot = useCallback(() => {
    setUndoStack((prev) => {
      const snapshot: EditSnapshot = {
        keyframes: keyframes.map((kf) => ({ ...kf })),
        trimStart,
        trimEnd,
        selectedId,
      };
      const next = [...prev, snapshot];
      return next.length > 80 ? next.slice(next.length - 80) : next;
    });
  }, [keyframes, trimStart, trimEnd, selectedId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const url = URL.createObjectURL(blob);
    video.src = url;
    video.load();

    return () => {
      video.pause();
      if (video.src === url) {
        video.removeAttribute("src");
        video.load();
      }
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  // Compute current zoom transform for preview
  const transform = getTransformAtTime(currentTime, keyframes);
  const hasZoom = transform.scale > 1.001;

  // RAF loop to update currentTime smoothly during playback
  useEffect(() => {
    if (!isPlaying) return;
    const tick = () => {
      const video = videoRef.current;
      if (video && !video.paused) {
        setCurrentTime(video.currentTime);
        // Stop at trim end
        if (video.currentTime >= trimEnd) {
          video.pause();
          setIsPlaying(false);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, trimEnd]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    if (!isFinite(video.duration)) {
      video.currentTime = 1e10;
      video.onseeked = () => {
        const dur = video.currentTime;
        setDuration(dur);
        setTrimEnd(dur);
        onTrimChange(0, dur * 1000);
        video.currentTime = 0;
        video.onseeked = null;
      };
    } else {
      setDuration(video.duration);
      setTrimEnd(video.duration);
      onTrimChange(0, video.duration * 1000);
    }
  };

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      // If past trim end or before trim start, jump to trimStart
      if (video.currentTime >= trimEnd || video.currentTime < trimStart) {
        video.currentTime = trimStart;
        setCurrentTime(trimStart);
      }
      video.play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          console.warn("Preview play failed:", err);
          setIsPlaying(false);
        });
    }
  }, [isPlaying, trimStart, trimEnd]);

  const handleSeek = useCallback((sec: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = sec;
    setCurrentTime(sec);
  }, []);

  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    // If a keyframe is selected, clicking video sets its center point
    if (selectedId) {
      pushUndoSnapshot();
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      setKeyframes((prev) =>
        prev.map((kf) =>
          kf.id === selectedId ? { ...kf, centerX: x, centerY: y } : kf,
        ),
      );
      return;
    }
    togglePlay();
  };

  const handleKeyframesChange = useCallback((updated: ZoomKeyframe[]) => {
    pushUndoSnapshot();
    setKeyframes(updated);
  }, [pushUndoSnapshot]);

  const handleTrimRangeChange = useCallback((startSec: number, endSec: number) => {
    pushUndoSnapshot();
    setTrimStart(startSec);
    setTrimEnd(endSec);
    onTrimChange(startSec * 1000, endSec * 1000);
  }, [onTrimChange, pushUndoSnapshot]);

  const handleDeleteKeyframe = useCallback(() => {
    if (!selectedId) return;
    pushUndoSnapshot();
    setKeyframes((prev) => prev.filter((kf) => kf.id !== selectedId));
    setSelectedId(null);
  }, [selectedId, pushUndoSnapshot]);

  const handleKeyframeUpdate = useCallback(
    (updated: ZoomKeyframe) => {
      pushUndoSnapshot();
      setKeyframes((prev) =>
        prev.map((kf) => (kf.id === updated.id ? updated : kf)),
      );
    },
    [pushUndoSnapshot],
  );

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setKeyframes(last.keyframes.map((kf) => ({ ...kf })));
      setTrimStart(last.trimStart);
      setTrimEnd(last.trimEnd);
      setSelectedId(last.selectedId);
      onTrimChange(last.trimStart * 1000, last.trimEnd * 1000);
      return prev.slice(0, -1);
    });
  }, [onTrimChange]);

  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo]);

  const selectedKeyframe = keyframes.find((kf) => kf.id === selectedId);

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header with actions — like Screen Studio top bar */}
        <div style={styles.header}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Preview & Edit</h3>
          <div style={styles.headerActions}>
            <button
              onClick={handleUndo}
              style={{ ...styles.headerBtn, opacity: undoStack.length > 0 ? 1 : 0.45 }}
              title="Undo last edit"
              disabled={undoStack.length === 0}
            >
              Undo
            </button>
            <button onClick={() => onExport("webm")} style={styles.exportBtn} title="Export as WebM">
              WebM
            </button>
            <button onClick={() => onExport("mp4")} style={styles.exportBtn} title="Export as MP4">
              MP4
            </button>
            <button onClick={onDiscard} style={styles.discardBtn} title="Discard recording">
              Discard
            </button>
            <button onClick={onClose} style={styles.closeBtn} title="Close preview">
              Close
            </button>
          </div>
        </div>

        {/* Video preview with zoom effect */}
        <div style={styles.videoContainer}>
          <video
            ref={videoRef}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            style={{
              ...styles.video,
              cursor: selectedId ? "crosshair" : "pointer",
              transform: hasZoom ? `scale(${transform.scale})` : "none",
              transformOrigin: `${transform.centerX * 100}% ${transform.centerY * 100}%`,
            }}
            onClick={handleVideoClick}
          />
        </div>

        {/* Controls */}
        <div style={styles.controls}>
          <button onClick={togglePlay} style={styles.playBtn}>
            {isPlaying ? "⏸" : "▶"}
          </button>
          <span style={styles.timeDisplay}>
            {formatTime(Math.floor(currentTime))} / {formatTime(Math.floor(duration))}
          </span>
          {trimStart > 0 || trimEnd < duration ? (
            <span style={styles.trimInfo}>
              ✂ {formatTime(Math.floor(trimStart))} – {formatTime(Math.floor(trimEnd))}
              ({formatTime(Math.floor(trimEnd - trimStart))})
            </span>
          ) : null}
          {selectedId && (
            <span style={styles.zoomHint}>
              🎯 Click video to set zoom center
            </span>
          )}
        </div>

        {/* Zoom editor panel */}
        {selectedKeyframe && (
          <ZoomEditor
            keyframe={selectedKeyframe}
            onChange={handleKeyframeUpdate}
            onDelete={handleDeleteKeyframe}
          />
        )}

        {/* Timeline */}
        {duration > 0 && (
          <Timeline
            durationSec={duration}
            currentTimeSec={currentTime}
            trimStartSec={trimStart}
            trimEndSec={trimEnd}
            keyframes={keyframes}
            selectedKeyframeId={selectedId}
            onSeek={handleSeek}
            onTrimChange={handleTrimRangeChange}
            onKeyframesChange={handleKeyframesChange}
            onSelectKeyframe={setSelectedId}
          />
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#1e1e2e",
    borderRadius: 12,
    width: "85vw",
    maxWidth: 1000,
    maxHeight: "92vh",
    overflow: "auto",
    color: "#cdd6f4",
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid #313244",
  },
  headerActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  headerBtn: {
    background: "#475569",
    border: "none",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    padding: "6px 14px",
    borderRadius: 6,
    cursor: "pointer",
  },
  exportBtn: {
    background: "#3b82f6",
    border: "none",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    padding: "6px 14px",
    borderRadius: 6,
    cursor: "pointer",
  },
  discardBtn: {
    background: "#45475a",
    border: "none",
    color: "#f38ba8",
    fontSize: 13,
    fontWeight: 600,
    padding: "6px 14px",
    borderRadius: 6,
    cursor: "pointer",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#cdd6f4",
    fontSize: 18,
    cursor: "pointer",
    padding: "4px 8px",
  },
  videoContainer: {
    padding: 16,
    display: "flex",
    justifyContent: "center",
    overflow: "hidden",
  },
  video: {
    maxWidth: "100%",
    maxHeight: "45vh",
    borderRadius: 8,
    background: "#000",
    transition: "transform 0.15s ease-out, transform-origin 0.15s ease-out",
  },
  controls: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "0 16px 8px",
  },
  playBtn: {
    background: "#313244",
    border: "none",
    color: "#cdd6f4",
    fontSize: 18,
    padding: "6px 12px",
    borderRadius: 8,
    cursor: "pointer",
  },
  timeDisplay: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 14,
  },
  zoomHint: {
    marginLeft: "auto",
    fontSize: 12,
    color: "#a78bfa",
  },
  trimInfo: {
    fontSize: 12,
    color: "#f9e2af",
    fontFamily: "'JetBrains Mono', monospace",
  },
};
