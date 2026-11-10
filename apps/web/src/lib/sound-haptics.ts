export type ScanFeedbackType = "valid" | "invalid" | "warning";

export interface ParsedQrPayload {
  qrToken: string;
  ticketCode?: string;
}

export function extractQrTokenFromInput(rawInput: string): ParsedQrPayload {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { qrToken: "" };
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      token?: string;
      qrToken?: string;
      ticketCode?: string;
      ticketId?: string;
    };
    if (typeof parsed.qrToken === "string" && parsed.qrToken.length > 0) {
      return { qrToken: parsed.qrToken, ticketCode: parsed.ticketCode };
    }
    if (typeof parsed.token === "string" && parsed.token.length > 0) {
      return { qrToken: parsed.token, ticketCode: parsed.ticketCode };
    }
  } catch {
    // Chuoi khong phai JSON -> su dung truc tiep lam qrToken
  }

  return { qrToken: trimmed };
}

export function isValidLast4Digits(value: string): boolean {
  return /^[A-Za-z0-9]{4}$/.test(value.trim());
}

export function triggerScanFeedback(type: ScanFeedbackType): void {
  if (typeof window === "undefined") return;

  try {
    if ("vibrate" in navigator && typeof navigator.vibrate === "function") {
      if (type === "valid") {
        navigator.vibrate(80);
      } else if (type === "warning") {
        navigator.vibrate([90, 50, 90]);
      } else {
        navigator.vibrate([140, 60, 140]);
      }
    }
  } catch {
    // Bo qua neu thiet bi khong ho tro rung
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

    const now = ctx.currentTime;
    if (type === "valid") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1174.66, now + 0.07);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    } else {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.setValueAtTime(196, now + 0.1);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.start(now);
      osc.stop(now + 0.26);
    }
  } catch {
    // Bo qua neu trinh duyet chan Autoplay AudioContext
  }
}
