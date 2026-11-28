"use client";

import { useSession } from "@/features/identity";
import { QueryProvider } from "@/shared/providers/query-provider";
import { useState } from "react";
import Link from "next/link";
import { BarChart3, ScanLine, UsersRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { organizerOperationsApi } from "../api/organizer-operations-api";
import {
  QueryMessage,
  Field,
  selectClass,
  panelClass,
} from "./operations-shared";
import { StaffManagement } from "./staff-management";
import { RevenueDashboard } from "./revenue-dashboard";
import { GateMonitoring } from "./gate-monitoring";

export type OperationsView = "staff" | "reports" | "monitor";
const navigation = [
  {
    view: "reports",
    href: "/organizer/dashboard",
    label: "Báo cáo doanh thu",
    shortLabel: "Doanh thu",
    icon: BarChart3,
  },
  {
    view: "staff",
    href: "/organizer/staff",
    label: "Nhân viên soát vé",
    shortLabel: "Nhân viên",
    icon: UsersRound,
  },
  {
    view: "monitor",
    href: "/organizer/gate-monitor",
    label: "Giám sát cổng",
    shortLabel: "Giám sát",
    icon: ScanLine,
  },
] as const;

type OperationsPageProps = {
  view: OperationsView;
  initialEventId?: string;
};

export function OrganizerOperationsPage(props: OperationsPageProps) {
  return (
    <QueryProvider>
      <OperationsContent {...props} />
    </QueryProvider>
  );
}

function OperationsContent({ view, initialEventId = "" }: OperationsPageProps) {
  const { user, isLoading } = useSession();
  const [selected, setSelected] = useState(initialEventId);
  const events = useQuery({
    queryKey: ["organizer", user?.id, "operation-events"],
    queryFn: ({ signal }) => organizerOperationsApi.events(signal),
    retry: false,
    enabled: !isLoading && (!user || user.role === "ORGANIZER"),
    staleTime: 0,
  });
  const eventId = selected || events.data?.[0]?.id || "";
  const event = events.data?.find((item) => item.id === eventId);
  const title = navigation.find((item) => item.view === view)!.label;
  if (!isLoading && user && user.role !== "ORGANIZER")
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-8">
        <p role="alert" className={panelClass}>
          Bạn cần đăng nhập bằng tài khoản Ban tổ chức để mở trang này.
        </p>
      </div>
    );
  return (
    <div className="mx-auto max-w-[1248px] space-y-4 px-4 py-7 sm:space-y-6 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {Boolean(events.data?.length) && (
          <div className="w-full sm:max-w-md">
            <Field label="Sự kiện">
              <select
                aria-label="Sự kiện"
                className={selectClass}
                value={eventId}
                onChange={(e) => setSelected(e.target.value)}
              >
                {!event && <option value="">Chọn sự kiện</option>}
                {events.data!.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </header>
      <nav
        aria-label="Vận hành sự kiện"
        className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-background p-1 sm:flex sm:w-fit"
      >
        {navigation.map((item) => (
          <Link
            key={item.view}
            href={item.href}
            aria-current={view === item.view ? "page" : undefined}
            className={`rounded-lg px-2 py-2.5 text-center text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring sm:px-4 sm:text-sm ${view === item.view ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <item.icon
                aria-hidden="true"
                className="hidden size-4 shrink-0 min-[360px]:block"
              />
              <span className="sm:hidden">{item.shortLabel}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </span>
          </Link>
        ))}
      </nav>
      <QueryMessage
        loading={events.isPending}
        error={events.error}
        retry={() => void events.refetch()}
      />
      {events.data && events.data.length === 0 && (
        <p className={panelClass}>
          Bạn chưa có sự kiện.{" "}
          <Link href="/organizer/events/new" className="underline">
            Tạo sự kiện đầu tiên
          </Link>
          .
        </p>
      )}
      {!events.isPending && !events.error && eventId && !event && (
        <p role="alert" className={panelClass}>
          Sự kiện không thuộc danh sách quản lý của bạn.
        </p>
      )}
      {event && (
        <section key={event.id} aria-label={title}>
          {view === "staff" ? (
            <StaffManagement eventId={event.id} />
          ) : view === "reports" ? (
            <RevenueDashboard eventId={event.id} />
          ) : (
            <GateMonitoring eventId={event.id} />
          )}
        </section>
      )}
    </div>
  );
}
