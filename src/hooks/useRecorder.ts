import { useCallback, useRef, useState } from "react";

export type RecordingMode = "canvas" | "screen";

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  mode: RecordingMode;
}

export interface RecordingResult {
  blob: Blob;
  duration: number;
  mimeType: string;
}

interface UseRecorderOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  microphoneEnabled: boolean;
  microphoneDeviceId?: string;
  frameRate?: number;
}

const TARGET_BITRATE = 8_000_000;
const AUDIO_BITRATE = 128_000;
const RECORDER_TIMESLICE_MS = 1000;

function selectMimeType(): string {
  const preferred = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return preferred.find((t) => MediaRecorder.isTypeSupported(t)) ?? "video/webm";
}

export function useRecorder({
  canvasRef,
  microphoneEnabled,
  microphoneDeviceId,
  frameRate = 30,
}: UseRecorderOptions) {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    elapsedSeconds: 0,
    mode: "canvas",
  });

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const accumulatedRef = useRef<number>(0);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const resultResolveRef = useRef<((r: RecordingResult | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    canvasStreamRef.current?.getTracks().forEach((t) => t.stop());
    canvasStreamRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {
        // Ignore close errors during cleanup.
      });
      audioContextRef.current = null;
    }
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    accumulatedRef.current = 0;
  }, []);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = accumulatedRef.current + (Date.now() - startTimeRef.current);
      setState((s) => ({ ...s, elapsedSeconds: Math.floor(elapsed / 1000) }));
    }, 200);
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const recorder = recorderRef.current;
    if (recorder && (recorder.state === "recording" || recorder.state === "paused")) {
      try {
        recorder.stop();
      } catch {
        // Already stopping
      }
    }
  }, []);

  const startRecording = useCallback(
    async (mode: RecordingMode, preAcquiredStream?: MediaStream): Promise<RecordingResult | null> => {
      chunksRef.current = [];
      accumulatedRef.current = 0;

      let videoStream: MediaStream;

      if (mode === "canvas") {
        const canvas = canvasRef.current;
        if (!canvas) throw new Error("Canvas not available");
        videoStream = canvas.captureStream(frameRate);
        canvasStreamRef.current = videoStream;
      } else if (preAcquiredStream) {
        videoStream = preAcquiredStream;
        screenStreamRef.current = videoStream;
        videoStream.getVideoTracks()[0].onended = () => {
          stopRecording();
        };
      } else {
        videoStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: frameRate } },
          audio: false,
        });
        screenStreamRef.current = videoStream;
        videoStream.getVideoTracks()[0].onended = () => {
          stopRecording();
        };
      }

      // Combine streams
      const combinedStream = new MediaStream(videoStream.getVideoTracks());

      if (microphoneEnabled) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: microphoneDeviceId
              ? { deviceId: { exact: microphoneDeviceId } }
              : true,
          });
          micStreamRef.current = micStream;

          // Mix audio via AudioContext
          const audioCtx = new AudioContext();
          audioContextRef.current = audioCtx;
          const micSource = audioCtx.createMediaStreamSource(micStream);
          const destination = audioCtx.createMediaStreamDestination();
          micSource.connect(destination);
          destination.stream.getAudioTracks().forEach((t) => combinedStream.addTrack(t));
        } catch (err) {
          console.warn("Microphone access failed:", err);
        }
      }

      const mimeType = selectMimeType();
      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: TARGET_BITRATE,
        audioBitsPerSecond: AUDIO_BITRATE,
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      const resultPromise = new Promise<RecordingResult | null>((resolve) => {
        resultResolveRef.current = resolve;
        recorder.onstop = () => {
          const elapsed = accumulatedRef.current + (Date.now() - startTimeRef.current);
          const blob = new Blob(chunksRef.current, { type: mimeType });
          resultResolveRef.current = null;
          if (blob.size > 0) {
            resolve({ blob, duration: elapsed, mimeType });
          } else {
            resolve(null);
          }
          cleanup();
          setState({
            isRecording: false,
            isPaused: false,
            elapsedSeconds: 0,
            mode: "canvas",
          });
        };
        recorder.onerror = () => {
          resultResolveRef.current = null;
          resolve(null);
          cleanup();
          setState({
            isRecording: false,
            isPaused: false,
            elapsedSeconds: 0,
            mode: "canvas",
          });
        };
      });

      recorderRef.current = recorder;
      recorder.start(RECORDER_TIMESLICE_MS);
      startTimer();
      setState({
        isRecording: true,
        isPaused: false,
        elapsedSeconds: 0,
        mode,
      });

      return resultPromise;
    },
    [canvasRef, microphoneEnabled, microphoneDeviceId, frameRate, cleanup, startTimer, stopRecording],
  );

  const togglePause = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;

    if (recorder.state === "recording") {
      recorder.pause();
      accumulatedRef.current += Date.now() - startTimeRef.current;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setState((s) => ({ ...s, isPaused: true }));
    } else if (recorder.state === "paused") {
      recorder.resume();
      startTimer();
      setState((s) => ({ ...s, isPaused: false }));
    }
  }, [startTimer]);

  const cancelRecording = useCallback(() => {
    resultResolveRef.current?.(null);
    resultResolveRef.current = null;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        // Already stopped
      }
    }
    cleanup();
    setState({
      isRecording: false,
      isPaused: false,
      elapsedSeconds: 0,
      mode: "canvas",
    });
  }, [cleanup]);

  return {
    state,
    startRecording,
    stopRecording,
    togglePause,
    cancelRecording,
  };
}
