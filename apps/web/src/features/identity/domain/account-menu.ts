import { UserRole } from "@tickethub/shared";

export interface AccountMenuItem {
  href: string;
  label: string;
}

const HELP: AccountMenuItem = { href: "/faq", label: "Trợ giúp" };

/** Mục trong menu tài khoản theo vai trò (không gồm nút đăng xuất). */
export function accountMenuItems(role: UserRole): AccountMenuItem[] {
  if (role === UserRole.ADMIN) {
    return [{ href: "/admin", label: "Cổng quản trị" }, HELP];
  }
  if (role === UserRole.ORGANIZER) {
    return [
      { href: "/organizer/events", label: "Quản lý sự kiện" },
      { href: "/organizer/events/new", label: "Tạo sự kiện" },
      { href: "/organizer/profile", label: "Hồ sơ" },
      HELP,
    ];
  }
  if (role === UserRole.BUYER) {
    return [
      { href: "/register?role=ORGANIZER", label: "Bán vé trên tickethub" },
      HELP,
    ];
  }
  return [HELP];
}

/** Chỉ người mua mới có vé của riêng mình để xem trên header. */
export function showsMyTickets(role: UserRole | null): boolean {
  return role === UserRole.BUYER;
}
