import { Module } from "@nestjs/common";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { env } from "../../config/env.config";
import { createIdentityUseCases } from "./identity.composition";
import { IDENTITY_USE_CASES } from "./application/identity-use-cases";
import { AuthController } from "./interface/auth.controller";
import { JwtAuthGuard } from "./interface/guards/jwt-auth.guard";
import { RolesGuard } from "./interface/guards/roles.guard";

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: env.JWT_SECRET,
      signOptions: { expiresIn: 900 },
    }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: IDENTITY_USE_CASES,
      useFactory: (jwt: JwtService) => createIdentityUseCases(jwt),
      inject: [JwtService],
    },
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [IDENTITY_USE_CASES, JwtAuthGuard, RolesGuard, JwtModule],
})
export class IdentityModule {}
