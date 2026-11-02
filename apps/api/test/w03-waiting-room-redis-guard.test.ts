import test from "node:test";
import assert from "node:assert/strict";
import {
  ServiceUnavailableException,
  type ExecutionContext,
} from "@nestjs/common";
import type Redis from "ioredis";
import type { Reflector } from "@nestjs/core";
import { WaitingRoomRateLimitGuard } from "../src/waiting-room/guards/waiting-room-rate-limit.guard";

test("TC17: Redis reconnecting => guard returns HTTP 503 immediately", async () => {
  let evalCalls = 0;
  const redis = {
    status: "reconnecting",
    eval: async () => {
      evalCalls++;
      return 1;
    },
  } as unknown as Redis;
  const reflector = { get: () => "join" } as unknown as Reflector;
  const guard = new WaitingRoomRateLimitGuard(redis, reflector);
  const context = {
    getHandler: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ ip: "127.0.0.1" }) }),
  } as unknown as ExecutionContext;

  await assert.rejects(
    () => guard.canActivate(context),
    (error: unknown) =>
      error instanceof ServiceUnavailableException && error.getStatus() === 503,
  );
  assert.equal(evalCalls, 0);
});

test("TC17: Redis command rejection => guard returns HTTP 503", async () => {
  const redis = {
    status: "ready",
    eval: async () => {
      throw new Error("Command timed out");
    },
  } as unknown as Redis;
  const reflector = { get: () => "join" } as unknown as Reflector;
  const guard = new WaitingRoomRateLimitGuard(redis, reflector);
  const context = {
    getHandler: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ ip: "127.0.0.1" }) }),
  } as unknown as ExecutionContext;

  await assert.rejects(
    () => guard.canActivate(context),
    (error: unknown) =>
      error instanceof ServiceUnavailableException && error.getStatus() === 503,
  );
});
