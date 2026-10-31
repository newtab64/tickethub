import { test, expect, type APIRequestContext } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const BASE_URL = "http://localhost:4000/api/v1";
const QUEUE_EVENT_ID = process.env.UC03_EVENT_ID;
const NO_QUEUE_EVENT_ID = process.env.UC03_NO_QUEUE_EVENT_ID;

async function loginBuyer(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${BASE_URL}/auth/login`, {
    data: {
      email: "pm.load.buyer.001@example.test",
      password: "Password123!",
    },
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.data.accessToken).toBeTruthy();

  return body.data.accessToken;
}
function getTicketTypeId(eventId: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      "tickethub-postgres",
      "psql",
      "-U",
      "tickethub",
      "-d",
      "tickethub_dev",
      "-At",
      "-c",
      `SELECT id FROM ticket_types WHERE event_id = '${eventId}' LIMIT 1;`,
    ],
    { encoding: "utf8" },
  ).trim();
}
test.describe("UC03 - Waiting Room API", () => {
  test.beforeAll(() => {
    expect(QUEUE_EVENT_ID).toBeTruthy();
    expect(NO_QUEUE_EVENT_ID).toBeTruthy();
  });

  test("TC01 - Chưa đăng nhập không được vào hàng chờ", async ({ request }) => {
    const response = await request.post(
      `${BASE_URL}/waiting-room/${QUEUE_EVENT_ID}/join`,
    );

    expect(response.status()).toBe(401);
  });

  test("TC02 - Sự kiện không tồn tại trả 404", async ({ request }) => {
    const token = await loginBuyer(request);

    const response = await request.post(
      `${BASE_URL}/waiting-room/00000000-0000-4000-8000-000000000000/join`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect(response.status()).toBe(404);
  });

  test("TC03 - Sự kiện không bật hàng chờ được vào ngay", async ({
    request,
  }) => {
    const token = await loginBuyer(request);

    const response = await request.post(
      `${BASE_URL}/waiting-room/${NO_QUEUE_EVENT_ID}/join`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data.status).toBe("ADMITTED");
    expect(body.data.admissionToken).toBeTruthy();
  });

  test("TC04 - Tham gia sự kiện có bật hàng chờ", async ({ request }) => {
    const token = await loginBuyer(request);

    const response = await request.post(
      `${BASE_URL}/waiting-room/${QUEUE_EVENT_ID}/join`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect([200, 202]).toContain(response.status());

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(["ADMITTED", "QUEUED"]).toContain(body.data.status);

    if (body.data.status === "ADMITTED") {
      expect(body.data.admissionToken).toBeTruthy();
    } else {
      expect(body.data.queuePosition).toBeGreaterThan(0);
    }
  });

  test("TC05 - Heartbeat trả về trạng thái hàng chờ hợp lệ", async ({
    request,
  }) => {
    const token = await loginBuyer(request);
    const headers = { Authorization: `Bearer ${token}` };

    const response = await request.post(
      `${BASE_URL}/waiting-room/${QUEUE_EVENT_ID}/heartbeat`,
      { headers },
    );

    expect([200, 202]).toContain(response.status());

    const body = await response.json();
    expect(["ADMITTED", "QUEUED"]).toContain(body.data.status);
  });
  test("TC06 - Một tài khoản tham gia nhiều lần không tạo phiên trùng", async ({
    request,
  }) => {
    const token = await loginBuyer(request);
    const url = `${BASE_URL}/waiting-room/${QUEUE_EVENT_ID}/join`;
    const headers = { Authorization: `Bearer ${token}` };

    const first = await request.post(url, { headers });
    const second = await request.post(url, { headers });

    expect([200, 202]).toContain(first.status());
    expect([200, 202]).toContain(second.status());

    const firstData = (await first.json()).data;
    const secondData = (await second.json()).data;

    expect(secondData.status).toBe(firstData.status);

    if (firstData.status === "QUEUED") {
      expect(secondData.queueId).toBe(firstData.queueId);
      expect(secondData.queuePosition).toBe(firstData.queuePosition);
    } else {
      expect(secondData.admissionToken).toBeTruthy();
    }
  });

  test("TC07 - MAX_ACTIVE đầy thì người mới phải xếp hàng", async ({
    request,
  }) => {
    const login = await request.post(`${BASE_URL}/auth/login`, {
      data: {
        email: "pm.load.buyer.026@example.test",
        password: "Password123!",
      },
    });

    expect(login.status()).toBe(200);

    const token = (await login.json()).data.accessToken;

    const response = await request.post(
      `${BASE_URL}/waiting-room/${QUEUE_EVENT_ID}/join`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect(response.status()).toBe(202);

    const body = await response.json();

    expect(body.data.status).toBe("QUEUED");
    expect(body.data.queuePosition).toBeGreaterThan(0);
  });

  test("TC08 - FIFO: Người vào trước có vị trí ưu tiên", async ({
    request,
  }) => {
    const login = await request.post(`${BASE_URL}/auth/login`, {
      data: {
        email: "pm.load.buyer.027@example.test",
        password: "Password123!",
      },
    });

    expect(login.status()).toBe(200);

    const token = (await login.json()).data.accessToken;

    const response = await request.post(
      `${BASE_URL}/waiting-room/${QUEUE_EVENT_ID}/join`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect(response.status()).toBe(202);

    const body = await response.json();

    expect(body.data.status).toBe("QUEUED");
    expect(body.data.queuePosition).toBe(2);
  });

  test("TC10 - Admission token có thời hạn 10 phút", async ({ request }) => {
    const token = await loginBuyer(request);

    const response = await request.post(
      `${BASE_URL}/waiting-room/${NO_QUEUE_EVENT_ID}/join`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status()).toBe(200);

    const body = await response.json();
    const admissionToken = body.data.admissionToken;

    expect(admissionToken).toBeTruthy();

    const payloadPart = admissionToken.split(".")[1];

    const payload = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8"),
    );

    expect(payload.type).toBe("waiting_room_admission");
    expect(payload.eventId).toBe(NO_QUEUE_EVENT_ID);
    expect(payload.exp - payload.iat).toBe(600);
  });

  const HOLD_API = `${BASE_URL}/booking/hold`;

  const INVALID_TICKET_TYPE_ID = "11111111-1111-4111-8111-111111111111";

  function createHoldBody(eventId: string) {
    return {
      eventId,
      items: [
        {
          ticketTypeId: INVALID_TICKET_TYPE_ID,
          quantity: 1,
        },
      ],
    };
  }

  test("TC11 - Admission token không dùng được cho sự kiện khác", async ({
    request,
  }) => {
    const token = await loginBuyer(request);

    const joinResponse = await request.post(
      `${BASE_URL}/waiting-room/${NO_QUEUE_EVENT_ID}/join`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect(joinResponse.status()).toBe(200);

    const admissionToken = (await joinResponse.json()).data.admissionToken;
    const response = await request.post(HOLD_API, {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-admission-token": admissionToken,
      },
      data: createHoldBody(QUEUE_EVENT_ID!),
    });

    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error.code).toBe("INVALID_ADMISSION_TOKEN");
  });

  test("TC12 - Admission token giả mạo bị từ chối", async ({ request }) => {
    const token = await loginBuyer(request);

    const response = await request.post(HOLD_API, {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-admission-token": "fake.invalid.token",
      },
      data: createHoldBody(QUEUE_EVENT_ID!),
    });

    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error.code).toBe("INVALID_ADMISSION_TOKEN");
  });

  test("TC13 - Thiếu admission token bị từ chối", async ({ request }) => {
    const token = await loginBuyer(request);

    const response = await request.post(HOLD_API, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: createHoldBody(QUEUE_EVENT_ID!),
    });

    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error.code).toBe("MISSING_ADMISSION_TOKEN");
  });

  test("TC14 - Admission token không dùng được cho tài khoản khác", async ({
    request,
  }) => {
    const tokenA = await loginBuyer(request);

    const joinResponse = await request.post(
      `${BASE_URL}/waiting-room/${QUEUE_EVENT_ID}/join`,
      {
        headers: { Authorization: `Bearer ${tokenA}` },
      },
    );

    expect(joinResponse.status()).toBe(200);

    const joinBody = await joinResponse.json();
    expect(joinBody.data.status).toBe("ADMITTED");

    const admissionToken = joinBody.data.admissionToken;

    const loginB = await request.post(`${BASE_URL}/auth/login`, {
      data: {
        email: "pm.load.buyer.002@example.test",
        password: "Password123!",
      },
    });

    expect(loginB.status()).toBe(200);
    const tokenB = (await loginB.json()).data.accessToken;

    const response = await request.post(`${BASE_URL}/booking/hold`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
        "x-admission-token": admissionToken,
      },
      data: createHoldBody(QUEUE_EVENT_ID!),
    });

    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error.code).toBe("INVALID_ADMISSION_TOKEN");
  });

  test("TC15 - Tự động chuyển lượt khi có chỗ trống", async ({ request }) => {
    test.setTimeout(30_000);

    const eventId = QUEUE_EVENT_ID!;

    function redis(...args: string[]): string {
      return execFileSync(
        "docker",
        ["exec", "tickethub-redis", "redis-cli", ...args],
        { encoding: "utf8" },
      ).trim();
    }

    const activeKey = `active_users:${eventId}`;
    const queueKey = `waiting_room:${eventId}`;
    const heartbeatPrefix = `w03:waiting-room:hb:${eventId}:`;

    const simulatedUsers = Array.from({ length: 20 }, () => randomUUID());

    redis("DEL", activeKey, queueKey);

    for (const userId of simulatedUsers) {
      redis("SADD", activeKey, userId);
      redis("SET", `${heartbeatPrefix}${userId}`, "1", "EX", "60");
    }

    expect(Number(redis("SCARD", activeKey))).toBe(20);

    const login = await request.post(`${BASE_URL}/auth/login`, {
      data: {
        email: "pm.load.buyer.026@example.test",
        password: "Password123!",
      },
    });

    expect(login.status()).toBe(200);
    const token = (await login.json()).data.accessToken;
    const headers = { Authorization: `Bearer ${token}` };

    const join = await request.post(
      `${BASE_URL}/waiting-room/${eventId}/join`,
      { headers },
    );

    expect(join.status()).toBe(202);
    expect((await join.json()).data.status).toBe("QUEUED");

    redis("SREM", activeKey, simulatedUsers[0]!);

    await expect
      .poll(() => Number(redis("SCARD", activeKey)), {
        timeout: 15_000,
        intervals: [1000],
      })
      .toBe(20);

    const heartbeat = await request.post(
      `${BASE_URL}/waiting-room/${eventId}/heartbeat`,
      { headers },
    );

    expect(heartbeat.status()).toBe(200);

    const body = await heartbeat.json();
    expect(body.data.status).toBe("ADMITTED");
    expect(body.data.admissionToken).toBeTruthy();
  });

  test("TC16 - Admission token bị từ chối khi mất heartbeat", async ({
    request,
  }) => {
    const eventId = QUEUE_EVENT_ID!;

    function redis(...args: string[]): string {
      return execFileSync(
        "docker",
        ["exec", "tickethub-redis", "redis-cli", ...args],
        { encoding: "utf8" },
      ).trim();
    }

    const activeKey = `active_users:${eventId}`;
    const queueKey = `waiting_room:${eventId}`;

    redis("DEL", activeKey, queueKey);

    const accessToken = await loginBuyer(request);
    const headers = { Authorization: `Bearer ${accessToken}` };

    const join = await request.post(
      `${BASE_URL}/waiting-room/${eventId}/join`,
      { headers },
    );

    expect(join.status()).toBe(200);

    const admissionToken = (await join.json()).data.admissionToken;
    expect(admissionToken).toBeTruthy();

    const accessPayload = JSON.parse(
      Buffer.from(accessToken.split(".")[1]!, "base64url").toString("utf8"),
    );

    const userId = accessPayload.sub as string;
    expect(userId).toBeTruthy();

    redis("DEL", `w03:waiting-room:hb:${eventId}:${userId}`);

    const response = await request.post(`${BASE_URL}/booking/hold`, {
      headers: {
        ...headers,
        "x-admission-token": admissionToken,
      },
      data: createHoldBody(eventId),
    });

    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error.code).toBe("INVALID_ADMISSION_TOKEN");
  });

  test("TC18 - Hai tab cùng tài khoản không tạo hai vị trí hàng chờ", async ({
    request,
  }) => {
    test.setTimeout(30_000);

    const eventId = QUEUE_EVENT_ID!;
    const activeKey = `active_users:${eventId}`;
    const queueKey = `waiting_room:${eventId}`;

    function redis(...args: string[]): string {
      return execFileSync(
        "docker",
        ["exec", "tickethub-redis", "redis-cli", ...args],
        { encoding: "utf8" },
      ).trim();
    }
    const simulatedUsers = Array.from({ length: 20 }, () => randomUUID());

    const commands: string[] = ["MULTI", `DEL ${activeKey} ${queueKey}`];

    for (const userId of simulatedUsers) {
      commands.push(`SADD ${activeKey} ${userId}`);
      commands.push(`SET w03:waiting-room:hb:${eventId}:${userId} 1 EX 60`);
    }

    commands.push("EXEC");

    const setup = spawnSync(
      "docker",
      ["exec", "-i", "tickethub-redis", "redis-cli", "--no-raw"],
      {
        input: commands.join("\n") + "\n",
        encoding: "utf8",
      },
    );

    expect(setup.status, setup.stderr).toBe(0);

    const activeCount = Number(redis("SCARD", activeKey));
    console.log("Active after setup:", activeCount);

    expect(activeCount).toBe(20);

    const loginResponse = await request.post(`${BASE_URL}/auth/login`, {
      data: {
        email: "pm.load.buyer.028@example.test",
        password: "Password123!",
      },
    });

    expect(loginResponse.status()).toBe(200);

    const accessToken = (await loginResponse.json()).data.accessToken;
    const headers = { Authorization: `Bearer ${accessToken}` };

    const [tab1, tab2] = await Promise.all([
      request.post(`${BASE_URL}/waiting-room/${eventId}/join`, { headers }),
      request.post(`${BASE_URL}/waiting-room/${eventId}/join`, { headers }),
    ]);

    expect(tab1.status()).toBe(202);
    expect(tab2.status()).toBe(202);

    const data1 = (await tab1.json()).data;
    const data2 = (await tab2.json()).data;

    expect(data1.status).toBe("QUEUED");
    expect(data2.status).toBe("QUEUED");

    expect(data1.queueId).toBe(data2.queueId);

    expect(Number(redis("ZCARD", queueKey))).toBe(1);

    expect(data1.queuePosition).toBe(1);
    expect(data2.queuePosition).toBe(1);
  });

  test("TC19 - Sự kiện hết vé phải thông báo SOLD_OUT", async ({ request }) => {
    test.setTimeout(30_000);

    const eventId = process.env.UC03_SOLD_OUT_EVENT_ID;
    expect(eventId).toBeTruthy();

    const activeKey = `active_users:${eventId}`;
    const queueKey = `waiting_room:${eventId}`;

    function redis(...args: string[]) {
      return execFileSync(
        "docker",
        ["exec", "tickethub-redis", "redis-cli", ...args],
        { encoding: "utf8" },
      ).trim();
    }

    function sql(query: string) {
      return execFileSync(
        "docker",
        [
          "exec",
          "tickethub-postgres",
          "psql",
          "-v",
          "ON_ERROR_STOP=1",
          "-U",
          "tickethub",
          "-d",
          "tickethub_dev",
          "-At",
          "-c",
          query,
        ],
        { encoding: "utf8" },
      ).trim();
    }

    const seatsAvailable = Number(
      sql(`
    SELECT COUNT(*) FROM seats
    WHERE event_id = '${eventId}'
      AND status = 'AVAILABLE';
  `),
    );

    const totalSeats = Number(
      sql(`
    SELECT COUNT(*) FROM seats
    WHERE event_id = '${eventId}';
  `),
    );

    expect(totalSeats).toBeGreaterThan(0);
    expect(seatsAvailable).toBe(totalSeats);

    try {
      sql(`
      UPDATE seats
      SET status = 'SOLD'
      WHERE event_id = '${eventId}';
    `);

      sql(`
      UPDATE ticket_types
      SET sold_count = capacity
      WHERE event_id = '${eventId}';
    `);

      const simulatedUsers = Array.from(
        { length: 20 },
        (_, i) => `tc19-simulated-${i}`,
      );

      const commands = ["MULTI", `DEL ${activeKey} ${queueKey}`];

      for (const userId of simulatedUsers) {
        commands.push(`SADD ${activeKey} ${userId}`);
        commands.push(`SET w03:waiting-room:hb:${eventId}:${userId} 1 EX 60`);
      }

      commands.push("EXEC");

      const setup = spawnSync(
        "docker",
        ["exec", "-i", "tickethub-redis", "redis-cli"],
        {
          input: commands.join("\n") + "\n",
          encoding: "utf8",
        },
      );

      expect(setup.status, setup.stderr).toBe(0);
      expect(Number(redis("SCARD", activeKey))).toBe(20);

      const login = await request.post(`${BASE_URL}/auth/login`, {
        data: {
          email: "pm.load.buyer.029@example.test",
          password: "Password123!",
        },
      });

      expect(login.status()).toBe(200);

      const token = (await login.json()).data.accessToken;
      const headers = { Authorization: `Bearer ${token}` };

      const join = await request.post(
        `${BASE_URL}/waiting-room/${eventId}/join`,
        { headers },
      );

      console.log("JOIN:", join.status(), await join.text());

      const heartbeat = await request.post(
        `${BASE_URL}/waiting-room/${eventId}/heartbeat`,
        { headers },
      );

      const body = await heartbeat.json();

      console.log("HEARTBEAT:", heartbeat.status(), body);

      expect(body.data?.status).toBe("SOLD_OUT");
    } finally {
      sql(`
      UPDATE seats SET status = 'AVAILABLE'
      WHERE event_id = '${eventId}';
    `);

      sql(`
      UPDATE ticket_types SET sold_count = 0
      WHERE event_id = '${eventId}';
    `);

      redis("DEL", activeKey, queueKey);
    }
  });

  test("TC20 - Tắt Waiting Room khi đang có người xếp hàng", async ({
    request,
  }) => {
    test.setTimeout(30_000);

    const eventId = process.env.UC03_DISABLE_EVENT_ID;
    expect(eventId).toBeTruthy();

    const activeKey = `active_users:${eventId}`;
    const queueKey = `waiting_room:${eventId}`;
    const hbPrefix = `w03:waiting-room:hb:${eventId}:`;

    function redis(...args: string[]): string {
      return execFileSync(
        "docker",
        ["exec", "tickethub-redis", "redis-cli", "--raw", ...args],
        { encoding: "utf8" },
      ).trim();
    }

    function sql(query: string): string {
      return execFileSync(
        "docker",
        [
          "exec",
          "tickethub-postgres",
          "psql",
          "-v",
          "ON_ERROR_STOP=1",
          "-U",
          "tickethub",
          "-d",
          "tickethub_dev",
          "-At",
          "-c",
          query,
        ],
        { encoding: "utf8" },
      ).trim();
    }

    const enabled = sql(`
    SELECT is_waiting_room_enabled
    FROM events WHERE id = '${eventId}';
  `);

    expect(enabled).toBe("t");

    const simulatedUsers = Array.from(
      { length: 20 },
      (_, i) => `tc20-simulated-${i}`,
    );

    const login = await request.post(`${BASE_URL}/auth/login`, {
      data: {
        email: "pm.load.buyer.030@example.test",
        password: "Password123!",
      },
    });

    expect(login.status()).toBe(200);

    const accessToken = (await login.json()).data.accessToken;
    const payload = JSON.parse(
      Buffer.from(accessToken.split(".")[1]!, "base64url").toString("utf8"),
    );

    const userId = payload.sub as string;
    const headers = { Authorization: `Bearer ${accessToken}` };

    try {
      const commands = ["MULTI", `DEL ${activeKey} ${queueKey}`];

      for (const id of simulatedUsers) {
        commands.push(`SADD ${activeKey} ${id}`);
        commands.push(`SET ${hbPrefix}${id} 1 EX 60`);
      }

      commands.push("EXEC");

      const setup = spawnSync(
        "docker",
        ["exec", "-i", "tickethub-redis", "redis-cli"],
        {
          input: commands.join("\n") + "\n",
          encoding: "utf8",
        },
      );

      expect(setup.status, setup.stderr).toBe(0);
      expect(Number(redis("SCARD", activeKey))).toBe(20);

      const join = await request.post(
        `${BASE_URL}/waiting-room/${eventId}/join`,
        { headers },
      );

      expect(join.status()).toBe(202);
      expect((await join.json()).data.status).toBe("QUEUED");

      expect(redis("ZRANK", queueKey, userId)).toBe("0");

      sql(`
      UPDATE events
      SET is_waiting_room_enabled = false
      WHERE id = '${eventId}';
    `);

      const heartbeat = await request.post(
        `${BASE_URL}/waiting-room/${eventId}/heartbeat`,
        { headers },
      );

      const body = await heartbeat.json();

      console.log("HEARTBEAT:", heartbeat.status(), body);

      expect(heartbeat.status()).toBe(200);
      expect(body.data.status).toBe("ADMITTED");
      expect(body.data.admissionToken).toBeTruthy();

      await expect
        .poll(() => redis("ZRANK", queueKey, userId), {
          timeout: 10_000,
          intervals: [1000],
        })
        .toBe("");
    } finally {
      sql(`
      UPDATE events
      SET is_waiting_room_enabled = true
      WHERE id = '${eventId}';
    `);

      redis("DEL", activeKey, queueKey);
      redis("DEL", `${hbPrefix}${userId}`);

      for (const id of simulatedUsers) {
        redis("DEL", `${hbPrefix}${id}`);
      }
    }
  });

  test("TC21 - Người dùng có đơn PENDING quay lại Waiting Room", async ({
    request,
  }) => {
    test.setTimeout(30_000);

    const eventId = QUEUE_EVENT_ID!;
    const ticketTypeId = getTicketTypeId(eventId);

    expect(ticketTypeId).toBeTruthy();

    function redis(...args: string[]): string {
      return execFileSync(
        "docker",
        ["exec", "tickethub-redis", "redis-cli", ...args],
        { encoding: "utf8" },
      ).trim();
    }

    const accessToken = await (async () => {
      const login = await request.post(`${BASE_URL}/auth/login`, {
        data: {
          email: "pm.load.buyer.031@example.test",
          password: "Password123!",
        },
      });

      expect(login.status()).toBe(200);
      return (await login.json()).data.accessToken as string;
    })();

    const headers = { Authorization: `Bearer ${accessToken}` };

    redis("DEL", `active_users:${eventId}`, `waiting_room:${eventId}`);

    let orderId: string | undefined;

    try {
      const firstJoin = await request.post(
        `${BASE_URL}/waiting-room/${eventId}/join`,
        { headers },
      );

      expect(firstJoin.status()).toBe(200);
      const admissionToken = (await firstJoin.json()).data.admissionToken;
      const hold = await request.post(`${BASE_URL}/booking/hold`, {
        headers: {
          ...headers,
          "x-admission-token": admissionToken,
        },
        data: {
          eventId,
          items: [{ ticketTypeId, quantity: 1 }],
        },
      });

      expect(hold.status(), await hold.text()).toBe(201);

      const holdBody = await hold.json();
      orderId = holdBody.data.orderId;
      expect(orderId).toBeTruthy();

      const secondJoin = await request.post(
        `${BASE_URL}/waiting-room/${eventId}/join`,
        { headers },
      );

      const secondBody = await secondJoin.json();

      console.log("RETURN JOIN:", secondJoin.status(), secondBody);
      expect(secondBody.data.orderId).toBe(orderId);
    } finally {
      if (orderId) {
        const release = await request.post(`${BASE_URL}/booking/release`, {
          headers,
          data: { orderId },
        });

        console.log("RELEASE:", release.status(), await release.text());
      }
    }
  });
});
