import { UserRole } from "@tickethub/shared";

export interface AccountMenuItem {
  href: string;
  label: string;
}

const HELP: AccountMenuItem = { href: "/faq", label: "Trợ giúp" };

/** Muc trong menu tai khoan theo vai tro (khong gom nut dang xuat). */
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
