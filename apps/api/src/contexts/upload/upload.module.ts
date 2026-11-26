import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { ConfirmEventImageUseCase } from "./application/confirm-event-image.use-case";
import { PresignEventImageUseCase } from "./application/presign-event-image.use-case";
import { UploadsController } from "./interface/uploads.controller";
import { createUploadUseCases } from "./upload.composition";

const UPLOAD_USE_CASES = Symbol("UPLOAD_USE_CASES");
type UploadUseCases = ReturnType<typeof createUploadUseCases>;

@Module({
  imports: [IdentityModule],
  controllers: [UploadsController],
  providers: [
    { provide: UPLOAD_USE_CASES, useFactory: () => createUploadUseCases() },
    {
      provide: PresignEventImageUseCase,
      useFactory: (u: UploadUseCases) => u.presign,
      inject: [UPLOAD_USE_CASES],
    },
    {
      provide: ConfirmEventImageUseCase,
      useFactory: (u: UploadUseCases) => u.confirm,
      inject: [UPLOAD_USE_CASES],
    },
  ],
})
export class UploadModule {}
