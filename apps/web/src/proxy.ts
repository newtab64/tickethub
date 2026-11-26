import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJwt } from "@/features/identity/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const accessCookie =
    request.cookies.get("accessToken")?.value ||
    request.cookies.get("access_token")?.value;

  const jwtPayload = await verifyJwt(accessCookie);
  const userRole = jwtPayload?.role || null;

  // 1. Bao ve cum Route ADMIN (/admin/*) -> Chi cho phep ADMIN
  if (pathname.startsWith("/admin")) {
    if (!jwtPayload) {
      const authUrl = new URL("/auth", request.url);
      authUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(authUrl);
    }
    if (userRole !== "ADMIN") {
      const homeUrl = new URL("/", request.url);
      homeUrl.searchParams.set("error", "forbidden_admin");
      return NextResponse.redirect(homeUrl);
    }
  }

  // 2. Bao ve cum Route ORGANIZER (/organizer/*) -> Chi cho phep ORGANIZER hoac ADMIN
  if (pathname.startsWith("/organizer")) {
    if (!jwtPayload) {
      const authUrl = new URL("/auth", request.url);
      authUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(authUrl);
    }
    if (userRole !== "ORGANIZER" && userRole !== "ADMIN") {
      const homeUrl = new URL("/", request.url);
      homeUrl.searchParams.set("error", "forbidden_organizer");
      return NextResponse.redirect(homeUrl);
    }
  }

  // 3. Bao ve trang Ve cua toi (/my-tickets/*) -> Yeu cau BUYER da dang nhap
  if (pathname.startsWith("/my-tickets")) {
    if (!jwtPayload) {
      const authUrl = new URL("/auth", request.url);
      authUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(authUrl);
    }
    // ADMIN va ORGANIZER khong the mua ve -> Tu dong dieu huong ve portal quan ly tuong ung
    if (userRole === "ADMIN") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    if (userRole === "ORGANIZER") {
      return NextResponse.redirect(new URL("/organizer/events", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/organizer/:path*", "/my-tickets/:path*"],
};
