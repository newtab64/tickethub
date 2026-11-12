import { randomUUID } from "node:crypto";
import type { PresignImageRequest } from "@tickethub/shared";
import {
  MAX_IMAGE_BYTES,
  buildImageKey,
  extensionFor,
  isValidUploadSize,
} from "../domain/image-rules";
import { uploadErrors } from "../domain/upload.errors";
import type {
  ObjectStorage,
  VerifiedOrganizerLookup,
} from "../domain/upload.ports";

const PRESIGN_TTL_SECONDS = 300;

export class PresignEventImageUseCase {
  constructor(
    private readonly organizers: VerifiedOrganizerLookup,
    private readonly storage: ObjectStorage,
    private readonly newId: () => string = randomUUID,
  ) {}

  async execute(userId: string, dto: PresignImageRequest) {
    const profileId = await this.organizers.findVerifiedProfileId(userId);
    if (!profileId) throw uploadErrors.organizerNotVerified();

    if (!isValidUploadSize(dto.sizeBytes)) throw uploadErrors.invalidSize();

    const extension = extensionFor(dto.contentType);
    if (!extension) throw uploadErrors.unsupportedFormat();

    const key = buildImageKey(profileId, this.newId(), extension);
    const uploadUrl = await this.storage.presignPut(
      key,
      dto.contentType,
      PRESIGN_TTL_SECONDS,
    );

    return {
      uploadUrl,
      key,
      publicUrl: this.storage.publicUrl(key),
      method: "PUT",
      headers: { "Content-Type": dto.contentType },
      expiresIn: PRESIGN_TTL_SECONDS,
      maxBytes: MAX_IMAGE_BYTES,
    };
  }
}
