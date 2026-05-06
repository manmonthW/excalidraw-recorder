import {
  getTransformAtTime,
  transformToSourceRect,
  type ZoomKeyframe,
} from "./motionEngine";

/**
 * Process a WebM blob: re-encode with zoom keyframes applied.
 *
 * Approach: play video in a hidden DOM container → draw each frame to canvas
 * with per-frame zoom interpolation → capture canvas stream → MediaRecorder → Blob.
 */
export async function trimVideo(
  blob: Blob,
  startMs: number,
  endMs: number,
  keyframes: ZoomKeyframe[] = [],
): Promise<Blob> {
  console.log("[trimVideo] called", { startMs, endMs, keyframeCount: keyframes.length });

  const url = URL.createObjectURL(blob);

  // Hidden DOM container — required for canvas.captureStream to work
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;pointer-events:none;opacity:0";
  document.body.appendChild(container);

  const video = document.createElement("video");
  video.playsInline = true;
  video.muted = true;
  video.src = url;
  container.appendChild(video);

  try {
    // Wait for metadata
    if (video.readyState < 1) {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Failed to load video"));
      });
    }

    // Wait for enough data
    if (video.readyState < 3) {
      await new Promise<void>((resolve) => {
        video.oncanplay = () => resolve();
      });
    }

    // Discover actual duration (WebM often reports Infinity)
    let actualDuration = video.duration;
    if (!isFinite(actualDuration)) {
      video.currentTime = 1e10;
      await new Promise<void>((r) => { video.onseeked = () => r(); });
      actualDuration = video.currentTime;
      video.currentTime = 0;
      await new Promise<void>((r) => { video.onseeked = () => r(); });
    }

    const w = video.videoWidth;
    const h = video.videoHeight;
    console.log("[trimVideo] video ready:", { w, h, duration: actualDuration });

    if (w === 0 || h === 0) {
      throw new Error(`Video has zero dimensions: ${w}x${h}`);
    }

    const resolvedEndSec = isFinite(endMs) ? endMs / 1000 : actualDuration;
    const startSec = startMs / 1000;

    // Create canvas in DOM
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    container.appendChild(canvas);
    const ctx = canvas.getContext("2d")!;

    // Prime canvas
    ctx.drawImage(video, 0, 0, w, h);

    // Capture stream at 30fps
    const canvasStream = canvas.captureStream(30);

    // Audio routing
    const audioCtx = new AudioContext();
    const audioSource = audioCtx.createMediaElementSource(video);
    const audioDest = audioCtx.createMediaStreamDestination();
    audioSource.connect(audioDest);

    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioDest.stream.getAudioTracks(),
    ]);

    const mimeType = blob.type || "video/webm";
    const recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 8_000_000,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    // Seek to start if needed
    if (startSec > 0.1) {
      video.currentTime = startSec;
      await new Promise<void>((r) => { video.onseeked = () => r(); });
      console.log("[trimVideo] seeked to", startSec);
    }

    // Start recording, then play
    recorder.start(100);
    video.muted = true;
    await video.play();
    console.log("[trimVideo] playback started, recording...");

    // Draw loop with per-frame zoom interpolation
    let frameCount = 0;
    await new Promise<void>((resolve) => {
      const drawFrame = () => {
        if (video.paused || video.ended || video.currentTime >= resolvedEndSec) {
          console.log(`[trimVideo] draw loop done: ${frameCount} frames, t=${video.currentTime.toFixed(2)}`);
          video.pause();
          resolve();
          return;
        }

        // Get zoom transform for current time
        const transform = getTransformAtTime(video.currentTime, keyframes);

        if (transform.scale > 1.001) {
          // Zoomed frame: crop source rect and draw scaled
          const { sx, sy, sw, sh } = transformToSourceRect(transform, w, h);
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
        } else {
          // Normal frame
          ctx.drawImage(video, 0, 0, w, h);
        }

        frameCount++;
        requestAnimationFrame(drawFrame);
      };
      requestAnimationFrame(drawFrame);

      // Safety timeout
      const maxMs = isFinite(resolvedEndSec - startSec)
        ? (resolvedEndSec - startSec) * 1000 + 10000
        : 300000;
      setTimeout(() => {
        if (!video.paused && !video.ended) {
          console.warn(`[trimVideo] safety timeout at ${frameCount} frames`);
          video.pause();
          resolve();
        }
      }, maxMs);
    });

    // Stop recorder and flush
    const result = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        audioCtx.close();
        const output = new Blob(chunks, { type: mimeType });
        console.log(`[trimVideo] output: ${chunks.length} chunks, ${(output.size / 1024 / 1024).toFixed(2)} MB`);
        resolve(output);
      };
      if (recorder.state === "recording") {
        recorder.stop();
      } else {
        resolve(new Blob(chunks, { type: mimeType }));
      }
    });

    return result;
  } finally {
    video.pause();
    video.src = "";
    video.load();
    if (container.parentNode) document.body.removeChild(container);
    URL.revokeObjectURL(url);
    console.log("[trimVideo] cleanup done");
  }
}

/**
 * Convert a video blob to GIF with optional trim and zoom keyframes.
 * Uses accelerated playback + requestAnimationFrame for fast frame capture
 * (avoids slow per-frame seeking on WebM).
 */
export async function convertToGif(
  videoBlob: Blob,
  startMs = 0,
  endMs = Infinity,
  keyframes: ZoomKeyframe[] = [],
  maxWidth = 480,
): Promise<Blob> {
  const GIF = (await import("gif.js")).default;

  const url = URL.createObjectURL(videoBlob);
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;opacity:0";
  document.body.appendChild(container);

  const video = document.createElement("video");
  video.playsInline = true;
  video.muted = true;
  video.src = url;
  container.appendChild(video);

  try {
    // Wait for metadata
    if (video.readyState < 1) {
      await new Promise<void>((res, rej) => {
        video.onloadedmetadata = () => res();
        video.onerror = () => rej(new Error("Failed to load video for GIF"));
      });
    }
    if (video.readyState < 3) {
      await new Promise<void>((r) => { video.oncanplay = () => r(); });
    }

    // Discover duration
    let dur = video.duration;
    if (!isFinite(dur)) {
      video.currentTime = 1e10;
      await new Promise<void>((r) => { video.onseeked = () => r(); });
      dur = video.currentTime;
      video.currentTime = 0;
      await new Promise<void>((r) => { video.onseeked = () => r(); });
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.min(1, maxWidth / vw);
    const w = Math.round(vw * scale);
    const h = Math.round(vh * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    container.appendChild(canvas);
    const ctx = canvas.getContext("2d")!;

    // Source-size canvas for zoom cropping
    const srcCanvas = document.createElement("canvas");
    srcCanvas.width = vw;
    srcCanvas.height = vh;
    const srcCtx = srcCanvas.getContext("2d")!;

    const gif = new GIF({
      workers: 4,
      quality: 10,
      width: w,
      height: h,
      workerScript: "/gif.worker.js",
    });

    const startSec = startMs / 1000;
    const endSec = isFinite(endMs) ? endMs / 1000 : dur;
    const fps = 8;
    const frameInterval = 1 / fps;
    const frameDelay = 1000 / fps;

    // Seek to start
    if (startSec > 0.05) {
      video.currentTime = startSec;
      await new Promise<void>((r) => { video.onseeked = () => r(); });
    }

    // Play at 4x speed and sample frames via requestAnimationFrame
    video.playbackRate = 4;
    await video.play();

    let lastCaptureTime = -1;
    let frameCount = 0;

    await new Promise<void>((resolve) => {
      const captureFrame = () => {
        if (video.paused || video.ended || video.currentTime >= endSec) {
          video.pause();
          resolve();
          return;
        }

        const t = video.currentTime;
        if (t - lastCaptureTime >= frameInterval * 0.8) {
          lastCaptureTime = t;

          // Apply zoom keyframes if any
          const transform = getTransformAtTime(t, keyframes);
          if (transform.scale > 1.001) {
            const { sx, sy, sw, sh } = transformToSourceRect(transform, vw, vh);
            srcCtx.drawImage(video, 0, 0, vw, vh);
            ctx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, w, h);
          } else {
            ctx.drawImage(video, 0, 0, w, h);
          }

          gif.addFrame(ctx, { copy: true, delay: frameDelay });
          frameCount++;
        }

        requestAnimationFrame(captureFrame);
      };
      requestAnimationFrame(captureFrame);

      // Safety timeout
      const maxMs = ((endSec - startSec) / 4 + 10) * 1000;
      setTimeout(() => {
        if (!video.paused && !video.ended) {
          console.warn(`[convertToGif] safety timeout at ${frameCount} frames`);
          video.pause();
          resolve();
        }
      }, maxMs);
    });

    console.log(`[convertToGif] captured ${frameCount} frames, ${w}x${h}, encoding...`);

    const blob = await new Promise<Blob>((resolve, reject) => {
      gif.on("finished", (b: Blob) => resolve(b));
      gif.on("error", (e: Error) => reject(e));
      gif.render();
    });

    console.log(`[convertToGif] done: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
    return blob;
  } finally {
    video.pause();
    video.src = "";
    video.load();
    if (container.parentNode) document.body.removeChild(container);
    URL.revokeObjectURL(url);
  }
}

/**
 * Convert WebM blob to MP4.
 * Currently returns WebM as-is (MP4 muxer to be added).
 */
export async function convertToMp4(webmBlob: Blob): Promise<Blob> {
  if (typeof VideoDecoder === "undefined" || typeof VideoEncoder === "undefined") {
    console.warn("WebCodecs not available, returning original WebM");
    return webmBlob;
  }
  console.info("MP4 conversion: using WebM format (MP4 muxer to be added)");
  return webmBlob;
}

/** Trigger a file download in the browser. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Format seconds to mm:ss display. */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
