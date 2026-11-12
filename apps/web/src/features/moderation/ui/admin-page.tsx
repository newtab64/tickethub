"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react";
import {
  getAdminAuditLogs,
  getAdminOrganizers,
  getAdminPendingEvents,
  reviewAdminEvent,
  reviewOrganizerProfile,
} from "../api/moderation-api";
import { formatDateTimeVi, formatNumberVi } from "@/shared/lib/format-vi";
import {
  getDisplayStatus,
  type OrganizerEventItem,
  type OrganizerProfile,
} from "@/features/organizer";
import { type AuditLogEntry } from "../domain/moderation.types";
import { parseAdminView } from "@/features/moderation/ui/admin-sidebar";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

// Ham an thong tin ca nhan (Decree 13/2023/ND-CP)
function maskIdentifier(val?: string): string {
  if (!val) return "";
  if (val.length <= 4) return val;
  return "*".repeat(val.length - 4) + val.slice(-4);
}

function maskPhone(phone?: string): string {
  if (!phone) return "";
  if (phone.length <= 4) return phone;
  return phone.slice(0, 3) + "****" + phone.slice(-3);
}

function maskEmail(email?: string): string {
  if (!email || !email.includes("@")) return email || "";
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `*@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

const BADGE_BASE =
  "inline-flex items-center h-5 px-1.5 rounded border text-[11px] font-medium whitespace-nowrap";
const BADGE_PENDING = "bg-amber-500/10 text-amber-700 border-amber-500/20";
const BADGE_OK = "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
const BADGE_BAD = "bg-destructive/10 text-destructive border-destructive/20";

type QueueRow = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  statusLabel: string;
  badgeClass: string;
  pending: boolean;
  searchText: string;
};

type Decision = { id: string; decision: "APPROVE" | "REJECT"; reason?: string };

export function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-xs text-muted-foreground">Đang tải...</div>
      }
    >
      <Workspace />
    </Suspense>
  );
}

function Workspace() {
  const view = parseAdminView(useSearchParams().get("view"));
  if (view === "audit") return <AuditView />;
  return <QueueView key={view} kind={view} />;
}

/* ------------------------------------------------------------------ */
/* Queue (organizer profiles / pending events) with detail side panel   */
/* ------------------------------------------------------------------ */

function QueueView({ kind }: { kind: "organizers" | "events" }) {
  const queryClient = useQueryClient();
  const isOrg = kind === "organizers";

  const { data: organizers = [], isLoading: loadingOrgs } = useQuery({
    queryKey: ["adminOrganizers"],
    queryFn: getAdminOrganizers,
    enabled: isOrg,
  });
  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["adminPendingEvents"],
    queryFn: getAdminPendingEvents,
    enabled: !isOrg,
  });
  const loading = isOrg ? loadingOrgs : loadingEvents;

  const [query, setQuery] = useState("");
  const [onlyPending, setOnlyPending] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [lastIndex, setLastIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: async (d: Decision) => {
      if (isOrg) await reviewOrganizerProfile(d);
      else await reviewAdminEvent(d);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: isOrg ? ["adminOrganizers"] : ["adminPendingEvents"],
      });
      queryClient.invalidateQueries({ queryKey: ["adminAuditLogs"] });
      if (isOrg) {
        queryClient.invalidateQueries({ queryKey: ["myOrganizerProfile"] });
      }
      setRejectFor(null);
    },
  });

  const rows: QueueRow[] = useMemo(() => {
    if (isOrg) {
      return organizers.map((o: OrganizerProfile) => {
        const pending = o.status === "PENDING_VERIFICATION";
        return {
          id: o.id,
          title: o.organizationName,
          subtitle: `ĐD: ${o.representativeName}`,
          meta: maskIdentifier(o.taxCode),
          statusLabel: pending
            ? "Chờ xác minh"
            : o.status === "VERIFIED"
              ? "Đã duyệt"
              : "Đã từ chối",
          badgeClass: pending
            ? BADGE_PENDING
            : o.status === "VERIFIED"
              ? BADGE_OK
              : BADGE_BAD,
          pending,
          searchText:
            `${o.organizationName} ${o.representativeName} ${o.taxCode}`.toLowerCase(),
        };
      });
    }
    return events.map((e: OrganizerEventItem) => {
      const meta = getDisplayStatus(e);
      return {
        id: e.id,
        title: e.title,
        subtitle: `${e.venueName} · ${e.city}`,
        meta: formatDateTimeVi(e.startTime),
        statusLabel: meta.label,
        badgeClass: meta.badgeClass,
        pending: e.status === "PENDING_APPROVAL",
        searchText: `${e.title} ${e.venueName} ${e.city}`.toLowerCase(),
      };
    });
  }, [isOrg, organizers, events]);

  const pendingCount = rows.filter((r) => r.pending).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) => (!onlyPending || r.pending) && (!q || r.searchText.includes(q)),
    );
  }, [rows, onlyPending, query]);

  // Giu vi tri chon: neu muc dang chon bien mat (da duyet), chon muc ke tiep
  const found = visible.findIndex((r) => r.id === selectedId);
  const selectedIndex =
    found >= 0 ? found : Math.min(lastIndex, visible.length - 1);
  const selected = visible[selectedIndex] ?? null;

  const rawOrg = isOrg ? organizers.find((o) => o.id === selected?.id) : null;
  const rawEvent = !isOrg ? events.find((e) => e.id === selected?.id) : null;

  const approve = useCallback(() => {
    if (!selected?.pending || mutation.isPending) return;
    mutation.mutate({ id: selected.id, decision: "APPROVE" });
  }, [selected, mutation]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }
      const move = (delta: number) => {
        if (visible.length === 0) return;
        const next = Math.max(
          0,
          Math.min(visible.length - 1, selectedIndex + delta),
        );
        setLastIndex(next);
        setSelectedId(visible[next].id);
        setRejectFor(null);
      };
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        move(1);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "a") {
        approve();
      } else if (e.key === "r" && selected?.pending) {
        e.preventDefault();
        setRejectFor(selected.id);
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, selectedIndex, selected, approve]);

  const mutationError =
    mutation.isError && mutation.variables?.id === selected?.id
      ? mutation.error.message || "Thao tác thất bại. Vui lòng thử lại."
      : null;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <Toolbar
        title={isOrg ? "Hồ sơ Ban tổ chức" : "Sự kiện chờ duyệt"}
        count={`${pendingCount} chờ duyệt`}
        query={query}
        onQuery={setQuery}
        searchRef={searchRef}
        placeholder={
          isOrg ? "Tìm tên đơn vị, MST..." : "Tìm sự kiện, địa điểm..."
        }
      >
        <div
          role="group"
          aria-label="Lọc trạng thái"
          className="inline-flex h-7 rounded-md border border-border bg-background p-0.5 text-xs"
        >
          {[
            { v: true, l: "Chờ duyệt" },
            { v: false, l: "Tất cả" },
          ].map((o) => (
            <button
              key={o.l}
              type="button"
              aria-pressed={onlyPending === o.v}
              onClick={() => setOnlyPending(o.v)}
              className={`px-2.5 rounded cursor-pointer transition-colors ${
                onlyPending === o.v
                  ? "bg-secondary font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </Toolbar>

      <div className="flex-1 min-h-0 flex">
        {/* Danh sach */}
        <div className="flex-1 min-w-0 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-muted text-muted-foreground">
              <tr className="text-left [&>th]:h-8 [&>th]:px-3 [&>th]:font-semibold">
                <th>{isOrg ? "Đơn vị / Đại diện" : "Sự kiện / Địa điểm"}</th>
                <th className="w-44">{isOrg ? "MST / CCCD" : "Bắt đầu"}</th>
                <th className="w-28">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const active = r.id === selected?.id;
                return (
                  <tr
                    key={r.id}
                    onClick={() => {
                      setSelectedId(r.id);
                      setLastIndex(visible.indexOf(r));
                      setRejectFor(null);
                    }}
                    aria-selected={active}
                    className={`cursor-pointer border-b border-border/60 [&>td]:px-3 [&>td]:py-1.5 ${
                      active
                        ? "bg-primary/5 shadow-[inset_2px_0_0_var(--primary)]"
                        : "bg-background hover:bg-secondary/50"
                    }`}
                  >
                    <td className="max-w-0">
                      <div className="font-medium text-foreground truncate">
                        {r.title}
                      </div>
                      <div className="text-muted-foreground truncate">
                        {r.subtitle}
                      </div>
                    </td>
                    <td className="font-mono tabular-nums text-muted-foreground">
                      {r.meta}
                    </td>
                    <td>
                      <span className={`${BADGE_BASE} ${r.badgeClass}`}>
                        {r.statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && visible.length === 0 && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {onlyPending && !query
                ? "Hàng đợi trống. Không có mục nào cần xử lý."
                : "Không có kết quả phù hợp."}
            </p>
          )}
          {loading && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Đang tải...
            </p>
          )}
        </div>

        {/* Chi tiet */}
        <aside className="w-[400px] shrink-0 border-l border-border bg-background overflow-y-auto">
          {selected ? (
            <DetailPanel
              key={selected.id}
              row={selected}
              org={rawOrg ?? null}
              event={rawEvent ?? null}
              rejecting={rejectFor === selected.id}
              busy={mutation.isPending}
              error={mutationError}
              onApprove={approve}
              onStartReject={() => setRejectFor(selected.id)}
              onCancelReject={() => setRejectFor(null)}
              onReject={(reason) =>
                mutation.mutate({
                  id: selected.id,
                  decision: "REJECT",
                  reason,
                })
              }
            />
          ) : (
            <p className="p-6 text-sm text-muted-foreground">
              Chọn một mục trong danh sách để xem chi tiết.
            </p>
          )}
        </aside>
      </div>

      <footer className="h-7 shrink-0 border-t border-border bg-background px-3 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span>
          <Kbd>j</Kbd> <Kbd>k</Kbd> di chuyển
        </span>
        <span>
          <Kbd>a</Kbd> duyệt
        </span>
        <span>
          <Kbd>r</Kbd> từ chối
        </span>
        <span>
          <Kbd>/</Kbd> tìm kiếm
        </span>
      </footer>
    </div>
  );
}

function DetailPanel({
  row,
  org,
  event,
  rejecting,
  busy,
  error,
  onApprove,
  onStartReject,
  onCancelReject,
  onReject,
}: {
  row: QueueRow;
  org: OrganizerProfile | null;
  event: OrganizerEventItem | null;
  rejecting: boolean;
  busy: boolean;
  error: string | null;
  onApprove: () => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onReject: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const rejectionReason = org?.rejectionReason ?? event?.rejectionReason;

  const fields: [string, string][] = org
    ? [
        ["Đại diện pháp luật", org.representativeName],
        ["MST / CCCD", maskIdentifier(org.taxCode)],
        ["Điện thoại", maskPhone(org.phone)],
        ["Email", maskEmail(org.email)],
        ["Địa chỉ", org.address],
        ["Cập nhật", formatDateTimeVi(org.updatedAt)],
      ]
    : event
      ? [
          ["Thể loại", event.category],
          ["Địa điểm", event.venueName],
          ["Địa chỉ", `${event.venueAddress}, ${event.city}`],
          ["Bắt đầu", formatDateTimeVi(event.startTime)],
          [
            "Tổng vé phát hành",
            Number.isFinite(event.ticketsTotal)
              ? `${formatNumberVi(event.ticketsTotal)} vé`
              : "Chưa có dữ liệu",
          ],
          ["Phiên bản", `v${event.version}`],
        ]
      : [];

  return (
    <div className="flex flex-col min-h-full">
      <div className="p-4 border-b border-border">
        <span className={`${BADGE_BASE} ${row.badgeClass}`}>
          {row.statusLabel}
        </span>
        <h2 className="mt-2 text-base font-bold leading-snug">{row.title}</h2>
        {rejectionReason && (
          <p className="mt-2 text-xs text-destructive">
            Lý do từ chối trước đó: {rejectionReason}
          </p>
        )}
      </div>

      <dl className="p-4 grid grid-cols-[110px_1fr] gap-y-2 text-xs flex-1 content-start">
        {fields.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium break-words">{v}</dd>
          </div>
        ))}
        {org?.businessLicenseUrl && (
          <>
            <dt className="text-muted-foreground">Giấy phép KD</dt>
            <dd>
              <a
                href={org.businessLicenseUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline font-medium"
              >
                Mở tệp đính kèm
              </a>
            </dd>
          </>
        )}
      </dl>

      {row.pending && (
        <div className="sticky bottom-0 border-t border-border bg-background p-3 space-y-2">
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          {rejecting ? (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!reason.trim()) {
                  setReasonError(true);
                  return;
                }
                onReject(reason.trim());
              }}
            >
              <Input
                autoFocus
                value={reason}
                aria-invalid={reasonError}
                onChange={(e) => {
                  setReason(e.target.value);
                  setReasonError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") onCancelReject();
                }}
                placeholder="Lý do từ chối (bắt buộc, gửi cho BTC)"
                className="h-8 text-xs"
              />
              {reasonError && (
                <p className="text-xs text-destructive">
                  Vui lòng nhập lý do từ chối.
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  variant="destructive"
                  className="flex-1"
                  disabled={busy}
                >
                  {busy ? "Đang xử lý..." : "Xác nhận từ chối"}
                </Button>
                <Button type="button" variant="ghost" onClick={onCancelReject}>
                  Hủy
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex gap-2">
              <Button className="flex-1" disabled={busy} onClick={onApprove}>
                <Check /> {event ? "Duyệt mở bán" : "Phê duyệt"}
                <Kbd tone="onPrimary">a</Kbd>
              </Button>
              <Button variant="outline" disabled={busy} onClick={onStartReject}>
                <X /> Từ chối <Kbd>r</Kbd>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Audit log                                                            */
/* ------------------------------------------------------------------ */

function AuditView() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["adminAuditLogs"],
    queryFn: getAdminAuditLogs,
  });
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter(
      (l: AuditLogEntry) =>
        !q ||
        `${l.action} ${l.targetName} ${l.actorEmail} ${l.reason ?? ""}`
          .toLowerCase()
          .includes(q),
    );
  }, [logs, query]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <Toolbar
        title="Nhật ký kiểm toán"
        count={`${logs.length} bản ghi, chỉ thêm mới`}
        query={query}
        onQuery={setQuery}
        searchRef={searchRef}
        placeholder="Tìm hành động, đối tượng, người thực hiện..."
      />
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-muted text-muted-foreground">
            <tr className="text-left [&>th]:h-8 [&>th]:px-3 [&>th]:font-semibold">
              <th className="w-40">Thời gian</th>
              <th className="w-44">Người thực hiện</th>
              <th className="w-44">Hành động</th>
              <th>Đối tượng</th>
              <th>Ghi chú / Lý do</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((l) => (
              <tr
                key={l.id}
                className="border-b border-border/60 bg-background [&>td]:px-3 [&>td]:py-1.5"
              >
                <td className="tabular-nums text-muted-foreground">
                  {formatDateTimeVi(l.timestamp)}
                </td>
                <td className="font-mono">{maskEmail(l.actorEmail)}</td>
                <td>
                  <span
                    className={`${BADGE_BASE} ${
                      l.action.startsWith("APPROVE") ? BADGE_OK : BADGE_BAD
                    }`}
                  >
                    {l.action}
                  </span>
                </td>
                <td className="font-medium">{l.targetName}</td>
                <td className="text-muted-foreground">{l.reason || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && visible.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Không có bản ghi phù hợp.
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                          */
/* ------------------------------------------------------------------ */

function Toolbar({
  title,
  count,
  query,
  onQuery,
  searchRef,
  placeholder,
  children,
}: {
  title: string;
  count: string;
  query: string;
  onQuery: (v: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  placeholder: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="h-12 shrink-0 border-b border-border bg-background px-3 flex items-center gap-3">
      <h1 className="text-sm font-bold">{title}</h1>
      <span className="text-xs text-muted-foreground tabular-nums">
        {count}
      </span>
      <div className="flex-1" />
      {children}
      <div className="relative w-64">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onQuery("");
              e.currentTarget.blur();
            }
          }}
          placeholder={placeholder}
          aria-label="Tìm kiếm"
          className="h-7 pl-7 text-xs"
        />
      </div>
    </div>
  );
}

function Kbd({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "onPrimary";
}) {
  return (
    <kbd
      className={`inline-flex items-center justify-center min-w-4 h-4 px-1 rounded border text-[10px] font-mono ${
        tone === "onPrimary"
          ? "border-white/30 bg-white/10 text-white"
          : "border-border bg-secondary text-muted-foreground"
      }`}
    >
      {children}
    </kbd>
  );
}
