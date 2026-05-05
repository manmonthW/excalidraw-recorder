/**
 * Motion engine — zoom keyframe interpolation for timeline-based editing.
 */

/** A zoom keyframe on the Motion track */
export interface ZoomKeyframe {
  id: string;
  startSec: number;
  endSec: number;
  centerX: number;      // 0–1, normalized
  centerY: number;      // 0–1, normalized
  scale: number;         // 1.0 = no zoom, 2.0 = 2x, etc.
  easeInSec: number;     // ease-in duration in seconds
  easeOutSec: number;    // ease-out duration in seconds
}

/** The computed transform at a given time */
export interface MotionTransform {
  scale: number;
  centerX: number;
  centerY: number;
}

/** Identity transform (no zoom) */
const IDENTITY: MotionTransform = { scale: 1, centerX: 0.5, centerY: 0.5 };

/** Cubic ease-in-out: smooth acceleration and deceleration */
export function easeInOutCubic(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Linear interpolation */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Compute the zoom transform at a given time by checking all keyframes.
 * If multiple keyframes overlap, the last one wins.
 */
export function getTransformAtTime(
  timeSec: number,
  keyframes: ZoomKeyframe[],
): MotionTransform {
  if (keyframes.length === 0) return IDENTITY;

  // Find the active keyframe (last one that contains this time)
  let active: ZoomKeyframe | null = null;
  for (const kf of keyframes) {
    if (timeSec >= kf.startSec && timeSec <= kf.endSec) {
      active = kf;
    }
  }

  if (!active) return IDENTITY;

  const { startSec, endSec, easeInSec, easeOutSec, scale, centerX, centerY } = active;
  const easeInEnd = startSec + easeInSec;
  const easeOutStart = endSec - easeOutSec;

  let progress: number;

  if (timeSec < easeInEnd) {
    // Ease-in phase: scale 1 → target
    const t = (timeSec - startSec) / easeInSec;
    progress = easeInOutCubic(t);
  } else if (timeSec > easeOutStart) {
    // Ease-out phase: scale target → 1
    const t = (timeSec - easeOutStart) / easeOutSec;
    progress = 1 - easeInOutCubic(t);
  } else {
    // Sustained phase: full zoom
    progress = 1;
  }

  return {
    scale: lerp(1, scale, progress),
    centerX: lerp(0.5, centerX, progress),
    centerY: lerp(0.5, centerY, progress),
  };
}

/** Generate a unique ID */
function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Create a default zoom keyframe at a given time */
export function createDefaultKeyframe(
  atSec: number,
  durationSec: number = 3,
): ZoomKeyframe {
  return {
    id: uid(),
    startSec: atSec,
    endSec: atSec + durationSec,
    centerX: 0.5,
    centerY: 0.5,
    scale: 2,
    easeInSec: 0.3,
    easeOutSec: 0.3,
  };
}

/**
 * Convert a MotionTransform to drawImage source-rect parameters.
 * Returns { sx, sy, sw, sh } for ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h).
 */
export function transformToSourceRect(
  transform: MotionTransform,
  videoWidth: number,
  videoHeight: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const { scale, centerX, centerY } = transform;
  const sw = videoWidth / scale;
  const sh = videoHeight / scale;
  const sx = Math.max(0, Math.min(centerX * videoWidth - sw / 2, videoWidth - sw));
  const sy = Math.max(0, Math.min(centerY * videoHeight - sh / 2, videoHeight - sh));
  return { sx, sy, sw, sh };
}
