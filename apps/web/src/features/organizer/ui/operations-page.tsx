"use client";

import { useSession } from "@/features/identity";
import { useState } from "react";
import Link from "next/link";
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
  { view: "reports", href: "/organizer/dashboard", label: "Báo cáo doanh thu" },
  { view: "staff", href: "/organizer/staff", label: "Nhân viên soát vé" },
  { view: "monitor", href: "/organizer/gate-monitor", label: "Giám sát cổng" },
] as const;

export function OrganizerOperationsPage({
  view,
  initialEventId = "",
}: {
  view: OperationsView;
  initialEventId?: string;
}) {
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
          Các chức năng vận hành W05 chỉ dành cho tài khoản Ban tổ chức. Vui
          lòng đăng nhập tài khoản ORGANIZER.
        </p>
      </div>
    );
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Vận hành sự kiện
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">
          Quản lý đội ngũ và theo dõi hiệu quả sự kiện của bạn.
        </p>
      </header>
      <nav
        aria-label="Vận hành sự kiện"
        className="flex flex-wrap gap-2 border-b border-border pb-4"
      >
        {navigation.map((item) => (
          <Link
            key={item.view}
            href={item.href}
            aria-current={view === item.view ? "page" : undefined}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${view === item.view ? "bg-primary text-primary-foreground" : "bg-background hover:bg-secondary"}`}
          >
            {item.label}
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
      {Boolean(events.data?.length) && (
        <div className={`${panelClass} max-w-xl`}>
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
