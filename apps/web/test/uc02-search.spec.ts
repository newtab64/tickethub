import { test, expect, type APIResponse } from "@playwright/test";
const API = "http://localhost:4000/api/v1/search/events";

test.describe("UC02 - Search API", () => {
  test("TC01 - Tìm kiếm sự kiện không cần đăng nhập", async ({ request }) => {
    const response = await request.get(API);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.items)).toBe(true);
  });

  test("TC02 - Từ khóa không có kết quả", async ({ request }) => {
    const response = await request.get(API, {
      params: { keyword: "zzzzkhongcosukien12345" },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data.items).toEqual([]);
  });

  test("TC03 - Khoảng giá không hợp lệ", async ({ request }) => {
    const response = await request.get(API, {
      params: { minPrice: 500000, maxPrice: 100000 },
    });

    expect(response.status()).toBe(400);
  });

  test("TC04 - Tham số phân trang không hợp lệ", async ({ request }) => {
    const response = await request.get(API, {
      params: { limit: 100 },
    });
    expect(response.status()).toBe(400);
  });

  test("TC05 - Cursor sai định dạng", async ({ request }) => {
    const response = await request.get(API, {
      params: { cursor: "not-a-uuid" },
    });

    expect(response.status()).toBe(400);
  });
  test("TC06 - Tìm kiếm tiếng Việt có dấu", async ({ request }) => {
    const response = await request.get(API, {
      params: { keyword: "Âm Nhạc" },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(
      body.data.items.some(
        (event: { title: string }) =>
          event.title === "Liveshow Âm Nhạc Mùa Thu 2026",
      ),
    ).toBe(true);
  });

  test("TC07 - Tìm kiếm tiếng Việt không dấu", async ({ request }) => {
    const response = await request.get(API, {
      params: { keyword: "Am Nhac" },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(
      body.data.items.some(
        (event: { title: string }) =>
          event.title === "Liveshow Âm Nhạc Mùa Thu 2026",
      ),
    ).toBe(true);
  });

  test("TC08 - Lọc theo thành phố", async ({ request }) => {
    const response = await request.get(API, {
      params: { city: "Ha Noi" },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data.items.length).toBeGreaterThan(0);
    expect(
      body.data.items.every(
        (event: { city: string }) => event.city === "Hà Nội",
      ),
    ).toBe(true);
  });

  test("TC09 - Lọc theo thể loại", async ({ request }) => {
    const response = await request.get(API, {
      params: { category: "Am nhac" },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data.items.length).toBeGreaterThan(0);
    expect(
      body.data.items.every(
        (event: { category: string }) => event.category === "Âm nhạc",
      ),
    ).toBe(true);
  });

  test("TC10 - Lọc theo khoảng giá vé", async ({ request }) => {
    const response = await request.get(API, {
      params: { minPrice: 500000, maxPrice: 700000 },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(
      body.data.items.some(
        (event: { title: string }) =>
          event.title === "Liveshow Âm Nhạc Mùa Thu 2026",
      ),
    ).toBe(true);
  });
  test("TC11 - Lọc theo khoảng thời gian", async ({ request }) => {
    const initial = await request.get(API, {
      params: { limit: 50 },
    });
    expect(initial.status()).toBe(200);

    const { data } = await initial.json();
    const target = data.items.find(
      (event: { slug: string }) => event.slug === "pm-load-2026-01",
    );

    expect(target).toBeDefined();

    const startTime = target.startTime;

    const response = await request.get(API, {
      params: {
        fromDate: startTime,
        toDate: startTime,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data.items.length).toBeGreaterThan(0);

    for (const event of body.data.items) {
      expect(new Date(event.startTime).getTime()).toBe(
        new Date(startTime).getTime(),
      );
    }
  });

  test("TC12 - Kết hợp nhiều bộ lọc", async ({ request }) => {
    const response = await request.get(API, {
      params: {
        city: "Ha Noi",
        category: "Am nhac",
        minPrice: 100000,
        maxPrice: 500000,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data.items.length).toBeGreaterThan(0);

    for (const event of body.data.items) {
      expect(event.city).toBe("Hà Nội");
      expect(event.category).toBe("Âm nhạc");

      expect(
        event.ticketTypes.some(
          (ticket: { price: string }) =>
            Number(ticket.price) >= 100000 && Number(ticket.price) <= 500000,
        ),
      ).toBe(true);
    }
  });

  test("TC13 - Phân trang không trùng sự kiện", async ({ request }) => {
    const allIds = new Set<string>();
    let cursor: string | null = null;
    let pageCount = 0;

    do {
      const response: APIResponse = await request.get(API, {
        params: {
          limit: 10,
          ...(cursor ? { cursor } : {}),
        },
      });

      expect(response.status()).toBe(200);

      const body: {
        data: {
          items: { id: string }[];
          nextCursor: string | null;
        };
      } = await response.json();
      for (const event of body.data.items) {
        expect(allIds.has(event.id)).toBe(false);
        allIds.add(event.id);
      }

      pageCount++;
      cursor = body.data.nextCursor;

      expect(pageCount).toBeLessThan(20);
    } while (cursor !== null);

    expect(pageCount).toBeGreaterThan(1);
    expect(allIds.size).toBeGreaterThanOrEqual(50);
  });

  test("TC14 - Chỉ trả về sự kiện PUBLISHED", async ({ request }) => {
    const response = await request.get(API, {
      params: { limit: 50 },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data.items.length).toBeGreaterThan(0);

    for (const event of body.data.items) {
      expect(event.status).toBe("PUBLISHED");
    }
  });

  test("TC15 - Sắp xếp kết quả theo độ liên quan", async ({ request }) => {
    const response = await request.get(API, {
      params: { keyword: "kiemthuxephang", limit: 50 },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    const items = body.data.items as Array<{
      slug: string;
      title: string;
    }>;

    const first = items.findIndex((event) => event.slug === "pm-load-2026-01");

    const second = items.findIndex((event) => event.slug === "pm-load-2026-02");

    expect(first).toBeGreaterThanOrEqual(0);
    expect(second).toBeGreaterThanOrEqual(0);

    expect(second).toBeLessThan(first);
  });

  test("TC16 - Keyword dưới 2 ký tự bỏ qua full-text search", async ({
    request,
  }) => {
    const response = await request.get(API, {
      params: {
        keyword: "x",
        limit: 10,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data.items.length).toBeGreaterThan(0);
  });
  test("TC17 - Khoảng ngày không hợp lệ", async ({ request }) => {
    const response = await request.get(API, {
      params: {
        fromDate: "2027-12-31T00:00:00.000Z",
        toDate: "2027-01-01T00:00:00.000Z",
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.success).toBe(false);
  });
});
