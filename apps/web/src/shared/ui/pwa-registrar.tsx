"use client";

import { useEffect } from "react";

/** Dang ky Service Worker de ho tro che do ngoai tuyen PWA (W06-FE2). */
export function PwaRegistrar() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV === "test"
    ) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  }, []);

  return null;
}
