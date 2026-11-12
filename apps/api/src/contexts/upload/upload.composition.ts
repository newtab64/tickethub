import { ConfirmEventImageUseCase } from "./application/confirm-event-image.use-case";
import { PresignEventImageUseCase } from "./application/presign-event-image.use-case";
import type {
  ObjectStorage,
  VerifiedOrganizerLookup,
} from "./domain/upload.ports";
import { DrizzleVerifiedOrganizerLookup } from "./infrastructure/drizzle-organizer.lookup";
import { S3ObjectStorage } from "./infrastructure/s3-object-storage";

export function createUploadUseCases(
  overrides: {
    organizers?: VerifiedOrganizerLookup;
    storage?: ObjectStorage;
  } = {},
) {
  const organizers =
    overrides.organizers ?? new DrizzleVerifiedOrganizerLookup();
  const storage = overrides.storage ?? new S3ObjectStorage();
  return {
    presign: new PresignEventImageUseCase(organizers, storage),
    confirm: new ConfirmEventImageUseCase(organizers, storage),
  };
}
