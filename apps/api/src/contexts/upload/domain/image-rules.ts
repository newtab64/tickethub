export type ImageContentType = "image/jpeg" | "image/png" | "image/webp";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Kich thuoc toi thieu de doc du 12 byte chu ky dinh dang. */
export const MIN_IMAGE_BYTES = 12;
export const SIGNATURE_RANGE = "bytes=0-11";

const PNG_MAGIC_BYTES = [137, 80, 78, 71, 13, 10, 26, 10];
const IMAGE_FILE_NAME =
  /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

const EXTENSIONS: Record<ImageContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function isValidUploadSize(sizeBytes: number): boolean {
  return (
    Number.isInteger(sizeBytes) && sizeBytes > 0 && sizeBytes <= MAX_IMAGE_BYTES
  );
}

export function extensionFor(
  contentType: ImageContentType,
): string | undefined {
  return EXTENSIONS[contentType];
}

/** Duong dan doi tuong: moi ban to chuc chi duoc ghi vao thu muc cua minh. */
export function organizerKeyPrefix(profileId: string): string {
  return `events/${profileId}/`;
}

export function buildImageKey(
  profileId: string,
  uuid: string,
  extension: string,
): string {
  return `${organizerKeyPrefix(profileId)}${uuid}.${extension}`;
}

export function isOwnedImageKey(profileId: string, key: string): boolean {
  const prefix = organizerKeyPrefix(profileId);
  return (
    key.startsWith(prefix) && IMAGE_FILE_NAME.test(key.slice(prefix.length))
  );
}

export function contentTypeForKey(key: string): ImageContentType {
  const extension = key.split(".").pop()?.toLowerCase();
  if (extension === "jpg") return "image/jpeg";
  if (extension === "png") return "image/png";
  return "image/webp";
}

export function isStoredSizeValid(contentLength: number | undefined): boolean {
  return (
    !!contentLength && contentLength > 0 && contentLength <= MAX_IMAGE_BYTES
  );
}

/** Doi chieu magic bytes voi dinh dang khai bao. */
export function hasValidSignature(
  contentType: ImageContentType,
  bytes: Uint8Array,
): boolean {
  if (contentType === "image/png") {
    return PNG_MAGIC_BYTES.every((value, index) => bytes[index] === value);
  }
  if (contentType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}
