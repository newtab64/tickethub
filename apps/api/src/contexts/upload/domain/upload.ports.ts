export interface VerifiedOrganizerLookup {
  /** Tra ve id ho so ban to chuc da xac minh va dang hoat dong, hoac null. */
  findVerifiedProfileId(userId: string): Promise<string | null>;
}

export interface StoredObjectInfo {
  contentLength?: number | undefined;
  contentType?: string | undefined;
}

export interface ObjectStorage {
  presignPut(
    key: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<string>;
  /** Tra ve null neu doi tuong khong ton tai. */
  head(key: string): Promise<StoredObjectInfo | null>;
  /** Doc `range` byte dau (vi du "bytes=0-11"); null neu khong doc duoc. */
  readRange(key: string, range: string): Promise<Uint8Array | null>;
  publicUrl(key: string): string | null;
}
