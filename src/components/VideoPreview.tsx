import { useEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/videoUtils";

interface VideoPreviewProps {
  blob: Blob;
  onTrimChange: (startMs: number, endMs: number) => void;
  onClose: () => void;
}

export function VideoPreview({ blob, onTrimChange, onClose }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const urlRef = useRef("");

  useEffect(() => {
    urlRef.current = URL.createObjectURL(blob);
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [blob]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    // Handle Infinity duration (common with WebM)
    if (!isFinite(video.duration)) {
      video.currentTime = 1e10;
      video.onseeked = () => {
        setDuration(video.currentTime);
        setTrimEnd(video.currentTime);
        video.currentTime = 0;
        video.onseeked = null;
      };
    } else {
      setDuration(video.duration);
      setTrimEnd(video.duration);
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    if (video.currentTime >= trimEnd) {
      video.pause();
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      if (video.currentTime >= trimEnd || video.currentTime < trimStart) {
        video.currentTime = trimStart;
      }
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTrimStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setTrimStart(val);
    onTrimChange(val * 1000, trimEnd * 1000);
    if (videoRef.current) videoRef.current.currentTime = val;
  };

  const handleTrimEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setTrimEnd(val);
    onTrimChange(trimStart * 1000, val * 1000);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Preview & Trim</h3>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <div style={styles.videoContainer}>
          <video
            ref={videoRef}
            src={urlRef.current}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            style={styles.video}
            onClick={togglePlay}
          />
        </div>

        <div style={styles.controls}>
          <button onClick={togglePlay} style={styles.playBtn}>
            {isPlaying ? "⏸" : "▶"}
          </button>
          <span style={styles.timeDisplay}>
            {formatTime(Math.floor(currentTime))} / {formatTime(Math.floor(duration))}
          </span>
        </div>

        <div style={styles.trimSection}>
          <div style={styles.trimLabel}>
            <span>Trim Start: {formatTime(Math.floor(trimStart))}</span>
            <span>Trim End: {formatTime(Math.floor(trimEnd))}</span>
          </div>
          <div style={styles.sliderRow}>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={trimStart}
              onChange={handleTrimStartChange}
              style={{ ...styles.slider, accentColor: "#3b82f6" }}
            />
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={trimEnd}
              onChange={handleTrimEndChange}
              style={{ ...styles.slider, accentColor: "#22c55e" }}
            />
          </div>
          <div style={styles.trimInfo}>
            Selected: {formatTime(Math.floor(trimEnd - trimStart))}
          </div>
        </div>
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
    width: "80vw",
    maxWidth: 900,
    maxHeight: "90vh",
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
  },
  video: {
    maxWidth: "100%",
    maxHeight: "50vh",
    borderRadius: 8,
    background: "#000",
    cursor: "pointer",
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
  trimSection: {
    padding: "8px 16px 16px",
    borderTop: "1px solid #313244",
  },
  trimLabel: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: "#a6adc8",
    marginBottom: 8,
  },
  sliderRow: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  slider: {
    width: "100%",
    cursor: "pointer",
  },
  trimInfo: {
    textAlign: "center",
    fontSize: 13,
    color: "#a6adc8",
    marginTop: 8,
  },
};
