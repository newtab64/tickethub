"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Building2, CalendarCheck, FileText, Home, LogOut } from "lucide-react";
import { Logo } from "@/shared/ui/logo";
import { useSession } from "@/features/identity";
import {
  getAdminAuditLogs,
  getAdminOrganizers,
  getAdminPendingEvents,
} from "../api/moderation-api";

export type AdminView = "organizers" | "events" | "audit";

export function parseAdminView(value: string | null): AdminView {
  return value === "events" || value === "audit" ? value : "organizers";
}

function SidebarInner() {
  const router = useRouter();
  const { user, logout } = useSession();
  const view = parseAdminView(useSearchParams().get("view"));

  const { data: organizers = [] } = useQuery({
    queryKey: ["adminOrganizers"],
    queryFn: getAdminOrganizers,
  });
  const { data: events = [] } = useQuery({
    queryKey: ["adminPendingEvents"],
    queryFn: getAdminPendingEvents,
  });
  const { data: auditLogs = [] } = useQuery({
    queryKey: ["adminAuditLogs"],
    queryFn: getAdminAuditLogs,
  });

  const pendingOrgs = organizers.filter(
    (o) => o.status === "PENDING_VERIFICATION",
  ).length;
  const pendingEvents = events.filter(
    (e) => e.status === "PENDING_APPROVAL",
  ).length;

  const items: {
    key: AdminView;
    label: string;
    icon: typeof Building2;
    count: number;
    urgent: boolean;
  }[] = [
    {
      key: "organizers",
      label: "Hồ sơ BTC",
      icon: Building2,
      count: pendingOrgs,
      urgent: true,
    },
    {
      key: "events",
      label: "Sự kiện chờ duyệt",
      icon: CalendarCheck,
      count: pendingEvents,
      urgent: true,
    },
    {
      key: "audit",
      label: "Nhật ký kiểm toán",
      icon: FileText,
      count: auditLogs.length,
      urgent: false,
    },
  ];

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-background flex flex-col">
      <div className="h-12 px-3 flex items-center gap-2 border-b border-border">
        <Logo />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Quản trị
        </span>
      </div>

      <nav
        aria-label="Điều hướng Quản trị"
        className="flex-1 p-2 space-y-0.5 text-sm"
      >
        <p className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Hàng đợi
        </p>
        {items.map((item) => {
          const active = item.key === view;
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={`/admin?view=${item.key}`}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 h-8 px-2 rounded-md transition-colors ${
                active
                  ? "bg-secondary text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              <span
                className={`min-w-5 px-1.5 rounded-full text-[11px] font-semibold text-center tabular-nums ${
                  item.urgent && item.count > 0
                    ? "bg-amber-500/15 text-amber-700"
                    : "text-muted-foreground"
                }`}
              >
                {item.count}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-2 space-y-0.5">
        <Link
          href="/"
          className="flex items-center gap-2 h-8 px-2 rounded-md text-xs text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
        >
          <Home className="size-3.5" />
          <span>Trang mua vé công khai</span>
        </Link>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="size-6 rounded-full bg-secondary text-foreground text-[11px] font-bold flex items-center justify-center">
            {user?.fullName ? user.fullName.charAt(0).toUpperCase() : "A"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate">
              {user?.fullName || "Quản trị viên"}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {user?.email || "admin@tickethub.vn"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Đăng xuất"
            title="Đăng xuất"
            onClick={async () => {
              await logout();
              router.push("/auth");
            }}
            className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export function AdminSidebar() {
  return (
    <Suspense
      fallback={<aside className="w-56 shrink-0 border-r bg-background" />}
    >
      <SidebarInner />
    </Suspense>
  );
}
