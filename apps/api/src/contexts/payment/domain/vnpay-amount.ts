const MAX_VND = 9_999_999_999n;

// Chuyen tien trong PostgreSQL thanh VND nguyen.
// Vi du: "150000.00" -> 150000
export function parseVndAmount(amount: unknown): number | null {
  if (typeof amount !== "string") {
    return null;
  }

  const match = /^(\d+)(?:\.(0{1,2}))?$/.exec(amount);

  if (!match || match[1] === undefined) {
    return null;
  }

  const value = BigInt(match[1]);

  if (value <= 0n || value > MAX_VND) {
    return null;
  }

  return Number(value);
}

// VNPay su dung don vi VND x 100.
// Vi du: "150000.00" -> "15000000"
export function toVnpayAmount(amount: string): string | null {
  const amountVnd = parseVndAmount(amount);

  if (amountVnd === null) {
    return null;
  }

  return String(amountVnd * 100);
}
