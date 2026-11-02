import { Module, Global } from "@nestjs/common";
import Redis from "ioredis";
import { env } from "../config/env.config";

export const REDIS_CLIENT = "REDIS_CLIENT";

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        return new Redis(env.REDIS_URL, {
          // HTTP API fail-fast: khong de lenh Redis doi reconnect hang giay.
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          connectTimeout: 700,
          commandTimeout: 800,
          // Van reconnect de API tu phuc hoi khi Redis quay lai.
          retryStrategy: (attempt) => Math.min(attempt * 200, 1000),
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
