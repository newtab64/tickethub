"use client";

import type { ScanFeedbackColor } from "./checkin-engine";

/**
 * Triggers instant Web Audio API acoustic feedback + mobile Haptic vibration (< 50ms latency)
 * for Gate Staff PWA (UC08):
 * - GREEN (VALID): High crisp double chime (1046Hz -> 1318Hz) + single 100ms vibration
 * - YELLOW (EXPIRED): Mid warning two-tone (660Hz -> 520Hz) + double 120ms vibration
 * - RED (INVALID / ALREADY_USED): Low alarm buzz (280Hz -> 220Hz) + strong triple vibration
 */
export function triggerScanFeedback(
  color: ScanFeedbackColor,
  options: { soundEnabled?: boolean; vibrateEnabled?: boolean } = {},
): void {
  const { soundEnabled = true, vibrateEnabled = true } = options;

  if (typeof window === "undefined") return;

  // 1. Mobile Haptic Feedback (navigator.vibrate)
  if (
    vibrateEnabled &&
    typeof navigator !== "undefined" &&
    "vibrate" in navigator
  ) {
    try {
      if (color === "GREEN") {
        navigator.vibrate(100);
      } else if (color === "YELLOW") {
        navigator.vibrate([120, 80, 120]);
      } else {
        navigator.vibrate([220, 90, 220, 90, 260]);
      }
    } catch {
      // Ignore vibration errors on unsupported devices
    }
  }

  // 2. Web Audio API Synthesizer Beep
  if (!soundEnabled) return;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (
      freq: number,
      startTime: number,
      duration: number,
      type: OscillatorType = "sine",
      gainVal = 0.18,
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(gainVal, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    if (color === "GREEN") {
      playTone(1046.5, now, 0.11, "sine", 0.2);
      playTone(1318.5, now + 0.11, 0.16, "sine", 0.22);
    } else if (color === "YELLOW") {
      playTone(660, now, 0.15, "triangle", 0.22);
      playTone(520, now + 0.17, 0.2, "triangle", 0.22);
    } else {
      playTone(260, now, 0.18, "sawtooth", 0.22);
      playTone(210, now + 0.21, 0.26, "sawtooth", 0.24);
    }
  } catch {
    // Ignore audio context restriction errors
  }
}
