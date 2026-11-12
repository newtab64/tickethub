const DEV_JWT_SECRET =
  "tickethub-super-secret-development-jwt-key-2026-min-32-chars";

export interface VerifiedJwtPayload {
  sub: string;
  email?: string;
  role?: string;
  exp?: number;
  [key: string]: unknown;
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = base64.padEnd(base64.length + padLength, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Xac thuc chu ky cryptographic HMAC-SHA256 cua JWT su dung Web Crypto API.
 * Khong phu thuoc thu vien ngoai, an toan tren Next.js Edge & Node runtime.
 */
export async function verifyJwt(
  token?: string,
): Promise<VerifiedJwtPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  const secret = process.env.JWT_SECRET || DEV_JWT_SECRET;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlToUint8Array(signatureB64);

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature as unknown as ArrayBuffer,
      data,
    );
    if (!isValid) return null;

    const payloadJson = new TextDecoder().decode(
      base64UrlToUint8Array(payloadB64),
    );
    const payload = JSON.parse(payloadJson) as VerifiedJwtPayload;

    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
