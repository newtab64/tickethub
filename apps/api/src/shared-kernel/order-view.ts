/** Nhan vi tri ghe hien thi tren ve; ve dung khong co hang/ghe (khong dung "N/A"). */
export function formatTicketSeatInfo(
  isSeated: boolean,
  ticketTypeName: string,
  seat: { zoneName: string; rowLabel: string; seatNumber: string } | null,
) {
  if (isSeated && seat) {
    const zonePrefix = seat.zoneName.startsWith("Khu")
      ? seat.zoneName
      : `Khu ${seat.zoneName}`;
    return {
      zoneName: seat.zoneName,
      rowLabel: seat.rowLabel,
      seatNumber: seat.seatNumber,
      formattedLabel: `${zonePrefix} - Hàng ${seat.rowLabel} - Ghế ${seat.seatNumber}`,
    };
  }

  return {
    zoneName: ticketTypeName,
    rowLabel: null,
    seatNumber: null,
    formattedLabel: `Khu vực: ${ticketTypeName} (Vé đứng)`,
  };
}

/** Gia thuc tra cua mot ve sau khi chia ty le voucher: unitPrice * final / total. */
export function calculateEffectivePaidPrice(
  unitPrice: number,
  totalAmount: number,
  finalAmount: number,
): number {
  if (totalAmount <= 0) return unitPrice;
  return Math.round(unitPrice * (finalAmount / totalAmount));
}
