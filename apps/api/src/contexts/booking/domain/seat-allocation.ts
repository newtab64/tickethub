import type { CandidateSeat } from "./booking.models";

export function parseSeatNumber(seatNum: string): number {
  const match = seatNum.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

const bySeatNumber = (a: CandidateSeat, b: CandidateSeat) =>
  parseSeatNumber(a.seatNumber) - parseSeatNumber(b.seatNumber);

/**
 * Chon `quantity` ghe, uu tien lien ke trong cung mot hang:
 * 1) chuoi lien tiep trong mot hang; 2) cung hang du khong lien tiep;
 * 3) khac hang. Tra ve mang rong neu khong du ung vien.
 */
export function findContiguousSeats(
  candidates: CandidateSeat[],
  quantity: number,
): CandidateSeat[] {
  if (candidates.length < quantity) return [];

  const byRow = new Map<string, CandidateSeat[]>();
  for (const seat of candidates) {
    const row = byRow.get(seat.rowLabel);
    if (row) row.push(seat);
    else byRow.set(seat.rowLabel, [seat]);
  }

  // Pass 1: chuoi ghe lien tiep trong cung hang
  for (const rowSeats of byRow.values()) {
    const sorted = [...rowSeats].sort(bySeatNumber);
    for (let i = 0; i + quantity <= sorted.length; i++) {
      let consecutive = true;
      for (let j = 0; j < quantity - 1; j++) {
        if (
          parseSeatNumber(sorted[i + j + 1]!.seatNumber) !==
          parseSeatNumber(sorted[i + j]!.seatNumber) + 1
        ) {
          consecutive = false;
          break;
        }
      }
      if (consecutive) return sorted.slice(i, i + quantity);
    }
  }

  // Pass 2: cung hang nhung khong lien tiep
  for (const rowSeats of byRow.values()) {
    if (rowSeats.length >= quantity) {
      return [...rowSeats].sort(bySeatNumber).slice(0, quantity);
    }
  }

  // Pass 3: ghe o nhieu hang
  return candidates.slice(0, quantity);
}

/** Sap xep ghe da cap phat theo hang roi so ghe de hien thi o trang Checkout. */
export function sortAllocatedSeats<
  T extends { rowLabel: string; seatNumber: string },
>(seats: T[]): T[] {
  return seats.sort((a, b) =>
    a.rowLabel !== b.rowLabel
      ? a.rowLabel.localeCompare(b.rowLabel)
      : parseSeatNumber(a.seatNumber) - parseSeatNumber(b.seatNumber),
  );
}
