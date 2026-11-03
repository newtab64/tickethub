// apps/web/test/uc02-uc03-w03.spec.ts
import { test, expect } from "@playwright/test";

test.describe("W03-FE1: Tìm kiếm SSR/SEO (UC02) & Hàng chờ ảo (UC03)", () => {
  test("UC02-TC01: Gợi ý nhỏ khi gõ tại Trang chủ, nhấn Enter sang Trang tìm kiếm (/search) với bộ lọc và phân trang Cursor", async ({
    page,
  }) => {
    await page.goto("/");

    const searchInput = page.getByTestId("search-keyword-input");
    await searchInput.fill("Hà Anh Tuấn");
    await expect(page.getByTestId("search-suggestions-dropdown")).toBeVisible();
    await expect(
      page.getByTestId("search-suggestion-item").first(),
    ).toContainText("Hà Anh Tuấn");

    await searchInput.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=/);
    await expect(page.getByTestId("search-results-heading")).toContainText(
      "Hà Anh Tuấn",
    );

    await page.getByTestId("reset-filters-btn").click();
    const loadMoreBtn = page.getByTestId("cursor-load-more-btn");
    await expect(loadMoreBtn).toBeVisible();
    await loadMoreBtn.click();

    await page.getByTestId("filter-category-sport").click();
    await expect(page).toHaveURL(/category=SPORT/);

    await page.getByTestId("filter-price-btn").click();
    await expect(page).toHaveURL(/price=/);
  });

  test("UC02-TC02: Trang chi tiết sự kiện có đầy đủ Open Graph metadata và xử lý trạng thái Hết vé + Đăng ký Email", async ({
    page,
  }) => {
    await page.goto("/events/evt-anh-trai-vuot-ngan-chong-gai?soldOut=true");

    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .first()
      .getAttribute("content");
    expect(ogTitle).toContain("Anh Trai Vượt Ngàn Chông Gai");

    await expect(page.getByTestId("event-soldout-banner")).toBeVisible();
    const emailInput = page.getByTestId("waitlist-email-input");
    await expect(emailInput).toBeVisible();

    await emailInput.fill("vikiet.w03@tickethub.vn");
    await page.getByTestId("waitlist-submit-btn").click();
    await expect(page.getByTestId("waitlist-success")).toBeVisible();
  });

  test("UC03-TC01: Màn hình Hàng chờ ảo tiêu thụ API joinQueue và hiển thị trạng thái cấp Admission Token", async ({
    page,
  }) => {
    await page.route("**/waiting-room/*/join", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            status: "ADMITTED",
            admissionToken: "jwt_admission_token_valid_10m",
          },
        }),
      });
    });

    await page.goto("/waiting-room?eventId=evt-anh-trai-vuot-ngan-chong-gai");

    await expect(page.getByTestId("queue-admitted-state")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("enter-booking-now-btn")).toBeVisible();
  });
});
