import { test, expect, type APIRequestContext } from "@playwright/test";

const BASE_URL = `${(process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "")}/api/v1`;
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
async function getTicketTypeId(
  request: APIRequestContext,
  eventId: string,
): Promise<string> {
  // Public API: khong truy van PostgreSQL truc tiep tu Playwright.
  const response = await request.get(`${BASE_URL}/events/${eventId}/inventory`);
  expect(response.status(), `Inventory for event ${eventId}`).toBe(200);
  const body: unknown = await response.json();
  const root = body as {
    data?: { items?: Array<{ ticketTypeId?: string; isSeated?: boolean }> };
  };
  const ticketType = root.data?.items?.find((item) => item.isSeated === true);
  expect(
    ticketType?.ticketTypeId,
    `Missing seated ticket type for ${eventId}`,
  ).toBeTruthy();
  return ticketType!.ticketTypeId!;
}

const WAITING_ROOM_FIXTURES = {
  tc07: "pm-uc03-max-active-two",
  tc08: "pm-uc03-fifo-two",
  tc18: "pm-uc03-two-tabs",
  tc15: "pm-uc03-auto-promote",
  tc16: "pm-uc03-heartbeat-expiry",
} as const;

async function getFixtureEventId(
  request: APIRequestContext,
  slug: string,
): Promise<string> {
  const response = await request.get(`${BASE_URL}/events/${slug}`);
  expect(response.status(), `Fixture ${slug} missing; run PM seed first`).toBe(
    200,
  );
  const body = (await response.json()) as {
    data?: {
      id?: string;
      maxActiveUsers?: number;
      isWaitingRoomEnabled?: boolean;
    };
  };
  expect(body.data?.id).toBeTruthy();
  expect(body.data?.isWaitingRoomEnabled).toBe(true);
  return body.data!.id!;
}

async function loginFixtureBuyer(
  request: APIRequestContext,
  index: number,
): Promise<string> {
  const email = `pm.load.buyer.${String(index).padStart(3, "0")}@example.test`;
  const response = await request.post(`${BASE_URL}/auth/login`, {
    data: {
      email,
      password: process.env.PM_LOAD_BUYER_PASSWORD ?? "Password123!",
    },
  });
  expect(response.status(), `Could not login ${email}`).toBe(200);
  const body = (await response.json()) as { data?: { accessToken?: string } };
  expect(body.data?.accessToken).toBeTruthy();
  return body.data!.accessToken!;
}

async function joinFixtureBuyer(
  request: APIRequestContext,
  eventId: string,
  token: string,
) {
  const response = await request.post(
    `${BASE_URL}/waiting-room/${eventId}/join`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const body = (await response.json()) as {
    data?: { status?: string; queuePosition?: number; queueId?: string };
  };
  return { status: response.status(), data: body.data };
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
    const eventId = await getFixtureEventId(
      request,
      WAITING_ROOM_FIXTURES.tc07,
    );
    const tokens = await Promise.all(
      [101, 102, 103].map((n) => loginFixtureBuyer(request, n)),
    );
    for (const token of tokens.slice(0, 2)) {
      const joined = await joinFixtureBuyer(request, eventId, token);
      expect(joined.status).toBe(200);
      expect(joined.data?.status).toBe("ADMITTED");
    }
    const waiting = await joinFixtureBuyer(request, eventId, tokens[2]!);
    expect(waiting.status).toBe(202);
    expect(waiting.data?.status).toBe("QUEUED");
    expect(waiting.data?.queuePosition).toBe(1);
  });

  test("TC08 - FIFO: Người vào trước có vị trí ưu tiên", async ({
    request,
  }) => {
    const eventId = await getFixtureEventId(
      request,
      WAITING_ROOM_FIXTURES.tc08,
    );
    const tokens = await Promise.all(
      [111, 112, 113, 114].map((n) => loginFixtureBuyer(request, n)),
    );
    for (const token of tokens.slice(0, 2)) {
      const joined = await joinFixtureBuyer(request, eventId, token);
      expect(joined.status).toBe(200);
      expect(joined.data?.status).toBe("ADMITTED");
    }
    const first = await joinFixtureBuyer(request, eventId, tokens[2]!);
    const second = await joinFixtureBuyer(request, eventId, tokens[3]!);
    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    expect(first.data?.status).toBe("QUEUED");
    expect(second.data?.status).toBe("QUEUED");
    expect(first.data?.queuePosition).toBe(1);
    expect(second.data?.queuePosition).toBe(2);
    expect(first.data?.queueId).not.toBe(second.data?.queueId);
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
    test.setTimeout(135_000);

    const eventId = await getFixtureEventId(
      request,
      WAITING_ROOM_FIXTURES.tc15,
    );
    const [buyerA, buyerB] = await Promise.all([
      loginFixtureBuyer(request, 131),
      loginFixtureBuyer(request, 132),
    ]);

    const first = await joinFixtureBuyer(request, eventId, buyerA);
    expect(first.status, "TC15 requires an empty, isolated active slot").toBe(
      200,
    );
    expect(first.data?.status).toBe("ADMITTED");

    const second = await joinFixtureBuyer(request, eventId, buyerB);
    expect(
      second.status,
      "Buyer B should wait while Buyer A occupies the only slot",
    ).toBe(202);
    expect(second.data?.status).toBe("QUEUED");
    expect(second.data?.queuePosition).toBe(1);

    await expect
      .poll(
        async () => {
          const response = await request.post(
            `${BASE_URL}/waiting-room/${eventId}/heartbeat`,
            { headers: { Authorization: `Bearer ${buyerB}` } },
          );
          expect([200, 202]).toContain(response.status());
          const body = (await response.json()) as {
            data?: { status?: string; admissionToken?: string };
          };
          if (body.data?.status === "ADMITTED") {
            expect(response.status()).toBe(200);
            expect(body.data.admissionToken).toBeTruthy();
          }
          return body.data?.status;
        },
        { timeout: 95_000, intervals: [4_000] },
      )
      .toBe("ADMITTED");
  });

  test("TC16 - Admission token bị từ chối khi mất heartbeat", async ({
    request,
  }) => {
    test.setTimeout(125_000);

    const eventId = await getFixtureEventId(
      request,
      WAITING_ROOM_FIXTURES.tc16,
    );
    const ticketTypeId = await getTicketTypeId(request, eventId);
    const buyerToken = await loginFixtureBuyer(request, 141);
    const joined = await request.post(
      `${BASE_URL}/waiting-room/${eventId}/join`,
      {
        headers: { Authorization: `Bearer ${buyerToken}` },
      },
    );
    expect(joined.status(), "TC16 requires an isolated free active slot").toBe(
      200,
    );
    const joinBody = (await joined.json()) as {
      data?: { status?: string; admissionToken?: string };
    };
    expect(joinBody.data?.status).toBe("ADMITTED");
    const admissionToken = joinBody.data?.admissionToken;
    expect(admissionToken).toBeTruthy();

    await new Promise<void>((resolve) => setTimeout(resolve, 67_000));

    const response = await request.post(`${BASE_URL}/booking/hold`, {
      headers: {
        Authorization: `Bearer ${buyerToken}`,
        "x-admission-token": admissionToken!,
      },
      data: { eventId, items: [{ ticketTypeId, quantity: 1 }] },
    });
    expect(response.status(), "Expired heartbeat must reject admission").toBe(
      403,
    );
    const body = (await response.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("INVALID_ADMISSION_TOKEN");
  });

  test("TC18 - Hai tab cùng tài khoản không tạo hai vị trí hàng chờ", async ({
    request,
  }) => {
    const eventId = await getFixtureEventId(
      request,
      WAITING_ROOM_FIXTURES.tc18,
    );
    const tokens = await Promise.all(
      [121, 122, 123].map((index) => loginFixtureBuyer(request, index)),
    );

    for (const token of tokens.slice(0, 2)) {
      const joined = await joinFixtureBuyer(request, eventId, token);
      expect(
        joined.status,
        "TC18 fixture must start with two available active slots",
      ).toBe(200);
      expect(joined.data?.status).toBe("ADMITTED");
    }

    const headers = { Authorization: `Bearer ${tokens[2]!}` };
    const url = `${BASE_URL}/waiting-room/${eventId}/join`;
    const [tab1, tab2] = await Promise.all([
      request.post(url, { headers }),
      request.post(url, { headers }),
    ]);

    expect(tab1.status()).toBe(202);
    expect(tab2.status()).toBe(202);
    const data1 = (await tab1.json()).data as {
      status?: string;
      queueId?: string;
      queuePosition?: number;
    };
    const data2 = (await tab2.json()).data as {
      status?: string;
      queueId?: string;
      queuePosition?: number;
    };
    expect(data1.status).toBe("QUEUED");
    expect(data2.status).toBe("QUEUED");
    expect(data1.queueId).toBeTruthy();
    expect(data1.queueId).toBe(data2.queueId);
    expect(data1.queuePosition).toBe(1);
    expect(data2.queuePosition).toBe(1);
  });

  test("TC19 - Sự kiện hết vé phải thông báo SOLD_OUT", async ({ request }) => {
    const slug = "pm-uc03-sold-out";
    const eventId = await getFixtureEventId(request, slug);

    const inventoryResponse = await request.get(
      `${BASE_URL}/events/${eventId}/inventory`,
    );
    expect(inventoryResponse.status()).toBe(200);
    const inventoryBody = (await inventoryResponse.json()) as {
      data?: {
        items?: Array<{
          isSeated?: boolean;
          capacity?: number;
          available?: number;
          sold?: number;
        }>;
      };
    };
    const seated =
      inventoryBody.data?.items?.filter((item) => item.isSeated === true) ?? [];
    expect(seated.length, "TC19 requires a seated ticket type").toBeGreaterThan(
      0,
    );
    expect(seated.every((item) => item.available === 0)).toBe(true);
    expect(seated.every((item) => (item.sold ?? 0) === item.capacity)).toBe(
      true,
    );

    const token = await loginFixtureBuyer(request, 151);
    const response = await request.post(
      `${BASE_URL}/waiting-room/${eventId}/join`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const body = (await response.json()) as { data?: { status?: string } };

    expect(
      body.data?.status,
      "A fully sold-out event must not admit or queue a buyer",
    ).toBe("SOLD_OUT");
  });

  // TODO (backend integration/fixture): Needs documented organizer API to toggle waiting-room flag and isolated queue fixture; old test updated DB and Redis.
  test.skip("TC20 - Tắt Waiting Room khi đang có người xếp hàng", async () => {
    // Blocked: PUT /events/:id only permits DRAFT events.
    // No supported API for toggling Waiting Room on PUBLISHED events.
  });

  test("TC21 - Người dùng có đơn PENDING quay lại Waiting Room", async ({
    request,
  }) => {
    test.setTimeout(30_000);

    const eventId = process.env.UC03_PENDING_EVENT_ID ?? QUEUE_EVENT_ID!;
    const ticketTypeId = await getTicketTypeId(request, eventId);

    expect(ticketTypeId).toBeTruthy();

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

    let orderId: string | undefined;

    try {
      const firstJoin = await request.post(
        `${BASE_URL}/waiting-room/${eventId}/join`,
        { headers },
      );

      expect(
        firstJoin.status(),
        "TC21 requires a clean dedicated event with free admission slots (UC03_PENDING_EVENT_ID)",
      ).toBe(200);
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

      expect(secondBody.data.orderId).toBe(orderId);
    } finally {
      if (orderId) {
        const release = await request.post(`${BASE_URL}/booking/release`, {
          headers,
          data: { orderId },
        });

        expect(release.status(), "Cleanup of pending order").toBe(200);
      }
    }
  });
});
