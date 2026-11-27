export const QR_SOON_SECONDS = 5;

/** Chi ve con hieu luc cua su kien dang mo moi xin duoc ma QR. */
export function canShowQr(
  ticket: { status: string },
  eventStatus: string,
): boolean {
  return ticket.status === "SOLD" && eventStatus === "PUBLISHED";
}

/** So giay con lai, tinh tu luc nhan ma nen khong phu thuoc gio may chu. */
export function qrSecondsLeft(
  receivedAt: number,
  remainingSeconds: number,
  now: number,
): number {
  const left = Math.ceil(remainingSeconds - (now - receivedAt) / 1000);
  return Math.min(remainingSeconds, Math.max(0, left));
}

/** May chu tu choi cap ma (khac voi loi tam thoi co the thu lai). */
export function isQrRejection(status: number | null): boolean {
  return (
    status !== null &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 429
  );
}

export type QrView = "loading" | "live" | "soon" | "offline" | "rejected";

export function qrView({
  hasToken,
  secondsLeft,
  errorStatus,
}: {
  hasToken: boolean;
  secondsLeft: number;
  errorStatus: number | null;
}): QrView {
  if (isQrRejection(errorStatus)) return "rejected";
  if (hasToken && secondsLeft > 0) {
    return secondsLeft <= QR_SOON_SECONDS ? "soon" : "live";
  }
  return errorStatus === null ? "loading" : "offline";
}
