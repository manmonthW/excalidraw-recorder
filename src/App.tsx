import { useCallback, useRef, useState } from "react";
import { Whiteboard } from "./components/Whiteboard";
import { Toolbar } from "./components/Toolbar";
import { VideoPreview } from "./components/VideoPreview";
import { CountdownOverlay } from "./components/CountdownOverlay";
import { useRecorder, type RecordingResult } from "./hooks/useRecorder";
import { downloadBlob, trimVideo, convertToMp4, convertToGif } from "./lib/videoUtils";
import type { ZoomKeyframe } from "./lib/motionEngine";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const preparingRef = useRef(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [recording, setRecording] = useState<RecordingResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [zoomKeyframes, setZoomKeyframes] = useState<ZoomKeyframe[]>([]);
  const [trimRange, setTrimRange] = useState<{ startMs: number; endMs: number } | null>(null);

  const { state, startRecording, stopRecording, togglePause, cancelRecording } = useRecorder({
    canvasRef,
    microphoneEnabled,
  });

  const runCountdown = useCallback(
    (onComplete: () => void) => {
      let count = 3;
      setCountdown(count);
      const interval = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setCountdown(count);
        } else {
          clearInterval(interval);
          setCountdown(null);
          onComplete();
        }
      }, 1000);
    },
    [],
  );

  const handleStartCanvas = useCallback(() => {
    if (preparingRef.current || state.isRecording || countdown !== null) return;
    preparingRef.current = true;
    runCountdown(async () => {
      try {
        const result = await startRecording("canvas");
        if (result) {
          setRecording(result);
          setZoomKeyframes([]);
          setTrimRange(null);
          setShowPreview(true);
        }
      } finally {
        preparingRef.current = false;
      }
    });
  }, [runCountdown, startRecording, state.isRecording, countdown]);

  const handleStartScreen = useCallback(async () => {
    if (preparingRef.current || state.isRecording || countdown !== null) return;

    // getDisplayMedia requires a secure context (HTTPS or localhost)
    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert(
        "Screen recording is not available.\n\n" +
        "This feature requires HTTPS or localhost.\n" +
        "Current origin: " + window.location.origin,
      );
      return;
    }

    preparingRef.current = true;

    // Acquire screen share FIRST so user picks a window before countdown
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: false,
      });
    } catch {
      // User cancelled the screen picker
      preparingRef.current = false;
      return;
    }

    runCountdown(async () => {
      try {
        const result = await startRecording("screen", stream);
        if (result) {
          setRecording(result);
          setZoomKeyframes([]);
          setTrimRange(null);
          setShowPreview(true);
        }
      } finally {
        preparingRef.current = false;
      }
    });
  }, [runCountdown, startRecording, state.isRecording, countdown]);

  const handleExport = useCallback(
    async (format: "webm" | "mp4" | "gif") => {
      if (!recording) return;
      setExporting(true);

      try {
        let blob = recording.blob;

        // Apply trim and/or zoom keyframes
        const hasKeyframes = zoomKeyframes.length > 0;
        const hasTrim = !!trimRange
          && (trimRange.startMs > 0 || trimRange.endMs < recording.duration - 10);
        if (hasKeyframes || hasTrim) {
          const startMs = trimRange?.startMs ?? 0;
          const endMs = trimRange?.endMs ?? Infinity;
          blob = await trimVideo(blob, startMs, endMs, zoomKeyframes);
        }

        // Convert format if needed
        if (format === "mp4") {
          blob = await convertToMp4(blob);
        } else if (format === "gif") {
          blob = await convertToGif(blob);
        }

        const ext = format;
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        downloadBlob(blob, `excalidraw-recording-${timestamp}.${ext}`);
      } catch (err) {
        console.error("Export failed:", err);
        alert("Export failed: " + (err instanceof Error ? err.message : String(err)));
      } finally {
        setExporting(false);
      }
    },
    [recording, zoomKeyframes, trimRange],
  );

  const handleDiscard = useCallback(() => {
    setRecording(null);
    setZoomKeyframes([]);
    setTrimRange(null);
    setShowPreview(false);
  }, []);

  return (
    <div style={styles.container}>
      <Toolbar
        recordingState={state}
        microphoneEnabled={microphoneEnabled}
        onStartCanvas={handleStartCanvas}
        onStartScreen={handleStartScreen}
        onStop={stopRecording}
        onPause={togglePause}
        onCancel={cancelRecording}
        onToggleMic={() => setMicrophoneEnabled(!microphoneEnabled)}
      />

      <div style={styles.main}>
        <Whiteboard canvasRef={canvasRef} isRecording={state.isRecording} />
      </div>

      {countdown !== null && <CountdownOverlay count={countdown} />}

      {state.isRecording && (
        <div style={styles.recordingIndicator}>
          <div style={styles.recordingDot} />
          REC
        </div>
      )}

      {exporting && (
        <div style={styles.exportOverlay}>
          <div style={styles.exportModal}>
            <div style={styles.spinner} />
            <span>Exporting...</span>
          </div>
        </div>
      )}

      {showPreview && recording && (
        <VideoPreview
          blob={recording.blob}
          onKeyframesChange={setZoomKeyframes}
          onTrimChange={(s, e) => setTrimRange({ startMs: s, endMs: e })}
          onExport={handleExport}
          onDiscard={handleDiscard}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Global styles */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        * { box-sizing: border-box; }
        button:hover { filter: brightness(1.15); }
        button:active { transform: scale(0.97); }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    width: "100vw",
    overflow: "hidden",
  },
  main: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  recordingIndicator: {
    position: "fixed",
    top: 56,
    right: 16,
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 12px",
    background: "rgba(239, 68, 68, 0.9)",
    color: "#fff",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
    zIndex: 50,
    letterSpacing: 1,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#fff",
    animation: "pulse 1.2s ease-in-out infinite",
  },
  exportOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
  },
  exportModal: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 32px",
    background: "#1e1e2e",
    borderRadius: 12,
    color: "#cdd6f4",
    fontSize: 16,
  },
  spinner: {
    width: 20,
    height: 20,
    border: "2px solid #45475a",
    borderTopColor: "#22c55e",
    borderRadius: "50%",
    animation: "spin 0.6s linear infinite",
  },
};
