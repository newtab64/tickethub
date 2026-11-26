import {
  MIN_IMAGE_BYTES,
  SIGNATURE_RANGE,
  contentTypeForKey,
  hasValidSignature,
  isOwnedImageKey,
  isStoredSizeValid,
} from "../domain/image-rules";
import { uploadErrors } from "../domain/upload.errors";
import type {
  ObjectStorage,
  VerifiedOrganizerLookup,
} from "../domain/upload.ports";

export class ConfirmEventImageUseCase {
  constructor(
    private readonly organizers: VerifiedOrganizerLookup,
    private readonly storage: ObjectStorage,
  ) {}

  async execute(userId: string, key: string) {
    const profileId = await this.organizers.findVerifiedProfileId(userId);
    if (!profileId) throw uploadErrors.organizerNotVerified();

    if (!isOwnedImageKey(profileId, key)) throw uploadErrors.forbiddenKey();

    const contentType = contentTypeForKey(key);

    const metadata = await this.storage.head(key);
    if (!metadata) throw uploadErrors.imageNotFound();

    if (!isStoredSizeValid(metadata.contentLength)) {
      throw uploadErrors.storedSizeInvalid();
    }
    if (metadata.contentLength! < MIN_IMAGE_BYTES) {
      throw uploadErrors.imageTooSmall();
    }
    if (metadata.contentType !== contentType) {
      throw uploadErrors.contentTypeMismatch();
    }

    const bytes = await this.storage.readRange(key, SIGNATURE_RANGE);
    if (!bytes || bytes.length < MIN_IMAGE_BYTES)
      throw uploadErrors.readError();
    if (!hasValidSignature(contentType, bytes)) {
      throw uploadErrors.invalidSignature();
    }

    return {
      key,
      contentType,
      sizeBytes: metadata.contentLength!,
      verified: true,
      publicUrl: this.storage.publicUrl(key),
    };
  }
}
