// apps/web/test/uc02-uc03-w03.spec.ts
import { test, expect } from "@playwright/test";

test.describe("W03-FE1: Tìm kiếm SSR/SEO (UC02) & Hàng chờ ảo (UC03)", () => {
  test("UC02-TC01: Gợi ý nhỏ khi gõ tại Trang chủ, nhấn Enter sang Trang tìm kiếm (/search) với bộ lọc và phân trang Cursor", async ({
    page,
  }) => {
    await page.goto("/");

    // 1. Gõ từ khóa vào thanh tìm kiếm -> Hiện dropdown gợi ý nhỏ, không làm mất mục Sự kiện thịnh hành
    const searchInput = page.getByTestId("search-keyword-input");
    await searchInput.fill("Hà Anh Tuấn");
    await expect(page.getByTestId("search-suggestions-dropdown")).toBeVisible();
    await expect(
      page.getByTestId("search-suggestion-item").first(),
    ).toContainText("Hà Anh Tuấn");

    // 2. Nhấn Enter -> Chuyển sang trang /search?q=...
    await searchInput.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=/);
    await expect(page.getByTestId("search-results-heading")).toContainText(
      "Hà Anh Tuấn",
    );

    // 3. Đặt lại bộ lọc để kiểm tra phân trang Cursor và bộ lọc Thể loại / Khoảng giá trên trang /search
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

    // Kiểm tra thẻ Open Graph phục vụ chia sẻ Facebook/Zalo
    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .first()
      .getAttribute("content");
    expect(ogTitle).toContain("Anh Trai Vượt Ngàn Chông Gai");

    // Kiểm tra hiển thị trạng thái Hết vé (Sold Out) và Form đăng ký Email Waitlist
    await expect(page.getByTestId("event-soldout-banner")).toBeVisible();
    const emailInput = page.getByTestId("waitlist-email-input");
    await expect(emailInput).toBeVisible();

    await emailInput.fill("vikiet.w03@tickethub.vn");
    await page.getByTestId("waitlist-submit-btn").click();
    await expect(page.getByTestId("waitlist-success")).toBeVisible();
  });

  test("UC03-TC01: Màn hình Hàng chờ ảo hiển thị số thứ tự, cập nhật tiến độ và cấp Admission Token", async ({
    page,
  }) => {
    await page.goto(
      "/waiting-room?eventId=evt-anh-trai-vuot-ngan-chong-gai&initialPos=2",
    );

    await expect(page.getByTestId("queue-position-value")).toBeVisible();
    await expect(page.getByTestId("queue-wait-value")).toBeVisible();

    // Đợi hàng chờ về 0 và nhận Admission Token
    await expect(page.getByTestId("queue-admitted-state")).toBeVisible({
      timeout: 12000,
    });
  });
});
