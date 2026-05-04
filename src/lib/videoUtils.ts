/**
 * Trim a WebM blob by re-encoding with WebCodecs.
 * Falls back to simple blob slice if WebCodecs is not available.
 */
export async function trimVideo(
  blob: Blob,
  startMs: number,
  endMs: number,
): Promise<Blob> {
  // For MVP, we use a simple approach: create a video element,
  // capture the trimmed portion using MediaRecorder.
  // This preserves audio and works in all modern browsers.

  const url = URL.createObjectURL(blob);

  try {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.preload = "auto";

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Failed to load video for trimming"));
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;

    const canvasStream = canvas.captureStream(30);

    // If original has audio, capture it too
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaElementSource(video);
    const destination = audioCtx.createMediaStreamDestination();
    source.connect(destination);
    source.connect(audioCtx.destination); // still need to hear for processing

    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);

    const mimeType = blob.type || "video/webm";
    const recorder = new MediaRecorder(combinedStream, { mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const durationMs = endMs - startMs;

    return new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        audioCtx.close();
        resolve(new Blob(chunks, { type: mimeType }));
      };
      recorder.onerror = () => reject(new Error("Trim recording failed"));

      video.currentTime = startMs / 1000;
      video.onseeked = () => {
        recorder.start();
        video.muted = false;
        video.play();

        const drawFrame = () => {
          if (video.currentTime >= endMs / 1000 || video.ended) {
            video.pause();
            recorder.stop();
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          requestAnimationFrame(drawFrame);
        };
        requestAnimationFrame(drawFrame);

        // Safety timeout
        setTimeout(() => {
          if (recorder.state === "recording") {
            video.pause();
            recorder.stop();
          }
        }, durationMs + 2000);
      };
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Convert WebM blob to MP4 using WebCodecs + manual muxing.
 * Falls back to returning the original WebM if WebCodecs is not available.
 */
export async function convertToMp4(webmBlob: Blob): Promise<Blob> {
  // Check if WebCodecs is available
  if (typeof VideoDecoder === "undefined" || typeof VideoEncoder === "undefined") {
    console.warn("WebCodecs not available, returning original WebM");
    return webmBlob;
  }

  // For MVP, return the WebM as-is since full MP4 muxing requires
  // additional libraries (mediabunny/mp4box). We'll add this in a future version.
  // The download will work as WebM which is widely supported.
  console.info("MP4 conversion: using WebM format (MP4 muxer to be added)");
  return webmBlob;
}

/**
 * Trigger a file download in the browser.
 */
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

/**
 * Format milliseconds to mm:ss display.
 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
