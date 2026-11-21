"use client";

import type { ScanVerdict } from "../domain/gate-rules";

/** Phat am bao va rung phan hoi tuc thi tai cong soat ve. */
export function triggerScanFeedback(verdict: ScanVerdict): void {
  if (typeof window === "undefined") return;

  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      if (verdict === "VALID") {
        navigator.vibrate(120);
      } else if (verdict === "DUPLICATE" || verdict === "EXPIRED") {
        navigator.vibrate([120, 80, 120]);
      } else {
        navigator.vibrate([220, 90, 220]);
      }
    } catch {
      // Bo qua neu thiet bi khong ho tro rung
    }
  }

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (verdict === "VALID") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1174, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start();
      osc.stop(ctx.currentTime + 0.23);
    } else if (verdict === "DUPLICATE" || verdict === "EXPIRED") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    }
  } catch {
    // Bo qua neu trinh duyet chan am thanh tu dong
  }
}
