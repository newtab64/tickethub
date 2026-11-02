import type Redis from "ioredis";

export async function clearDisabledWaitingRoom(
  redis: Redis,
  eventId: string,
): Promise<void> {
  const queueKey = `waiting_room:${eventId}`;
  const activeKey = `active_users:${eventId}`;
  const heartbeatPrefix = `w03:waiting-room:hb:${eventId}:`;

  const results = await redis
    .multi()
    .unlink(queueKey, activeKey)
    .srem("w03:waiting-room:events", eventId)
    .exec();

  if (!results || results.some(([error]) => error !== null)) {
    throw new Error("WAITING_ROOM_CLEANUP_FAILED");
  }

  // Remove all heartbeat keys, including users no longer in either set.
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(
      cursor,
      "MATCH",
      `${heartbeatPrefix}*`,
      "COUNT",
      200,
    );
    if (keys.length > 0) {
      await redis.unlink(...keys);
    }
    cursor = next;
  } while (cursor !== "0");
}
