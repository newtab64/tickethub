"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Search,
  CheckCircle2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Calendar,
  Eye,
  Copy,
  Edit,
  Pause,
  Trash2,
  RefreshCw,
  Layers,
} from "lucide-react";
import { EventStatus } from "@tickethub/shared";
import {
  formatVndCurrency as formatVnd,
  formatDateTimeVi,
  formatNumberVi,
} from "@/shared/lib/format-vi";
import { getDisplayStatus } from "../domain/display-status";
import {
  publishOrganizerEvent,
  pauseOrganizerEvent,
  cancelOrganizerEvent,
  cloneOrganizerEvent,
} from "../api/organizer-events-api";
import { ImagePlaceholder } from "@/shared/ui/image-placeholder";
import type { OrganizerEventsScreen } from "./use-organizer-events-screen";
import { getStatusIcon } from "./organizer-events-content-helpers";

/** Khoi giao dien: table-views. */
export function EventsTableViews({ vm }: { vm: OrganizerEventsScreen }) {
  const {
    router,
    currentPage,
    setCurrentPage,
    previewState,
    setPreviewState,
    activeMenuId,
    setActiveMenuId,
    menuContainerRef,
    updateUrlParams,
    filteredEvents,
    pageSize,
    totalItems,
    totalPages,
    paginatedEvents,
    handleClearFilters,
    hasActiveFilters,
  } = vm;

  return (
    <>
      <div className="bg-background rounded-lg border border-border overflow-hidden">
        {/* Loading Skeleton State */}
        {previewState === "LOADING" && (
          <div
            className="p-6 space-y-4"
            role="status"
            aria-label="Đang tải dữ liệu sự kiện"
          >
            <div className="h-4 bg-secondary rounded w-48 animate-pulse" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3.5 rounded-md border border-border/50 animate-pulse gap-4"
                >
                  <div className="flex items-center gap-3 w-1/3">
                    <div className="size-11 rounded-md bg-secondary shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-secondary rounded w-3/4" />
                      <div className="h-3 bg-secondary rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-4 bg-secondary rounded w-1/5" />
                  <div className="h-4 bg-secondary rounded w-1/6" />
                  <div className="h-4 bg-secondary rounded w-1/8" />
                  <div className="h-8 bg-secondary rounded w-12" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* API Error State (matching contract error shape) */}
        {previewState === "ERROR" && (
          <div className="p-12 text-center space-y-3" role="alert">
            <div className="size-12 rounded-full bg-red-50 text-destructive flex items-center justify-center mx-auto">
              <AlertCircle className="size-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-foreground">
                Không thể tải danh sách sự kiện
              </h3>
              <p className="text-xs text-muted-foreground">
                Máy chủ trả về mã lỗi{" "}
                <code className="font-mono text-destructive">
                  INTERNAL_SERVER_ERROR (HTTP 500)
                </code>
                . Vui lòng kiểm tra kết nối mạng hoặc thử lại sau giây lát.
              </p>
              <p className="text-[11px] text-muted-foreground font-mono">
                Mã yêu cầu: req_01HZX890ABCDEF • {new Date().toISOString()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPreviewState("NORMAL")}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <RefreshCw className="size-3.5" />
              <span>Thử lại</span>
            </button>
          </div>
        )}

        {/* Empty List State (Zero events in account) */}
        {previewState === "NORMAL" &&
          filteredEvents.length === 0 &&
          !hasActiveFilters && (
            <div className="p-12 text-center space-y-3">
              <div className="size-12 rounded-full bg-secondary flex items-center justify-center mx-auto text-muted-foreground">
                <Calendar className="size-6" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-base font-bold text-foreground">
                  Chưa có sự kiện nào
                </h3>
                <p className="text-xs text-muted-foreground">
                  Bạn chưa khởi tạo sự kiện nào trên tickethub. Hãy bắt đầu bằng
                  cách tạo sự kiện đầu tiên.
                </p>
              </div>
              <Link
                href="/organizer/events/new"
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                Tạo sự kiện ngay
              </Link>
            </div>
          )}

        {/* No Results State (Filters produced empty result) */}
        {previewState === "NORMAL" &&
          filteredEvents.length === 0 &&
          hasActiveFilters && (
            <div className="p-12 text-center space-y-3">
              <div className="size-12 rounded-full bg-secondary flex items-center justify-center mx-auto text-muted-foreground">
                <Search className="size-6" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-base font-bold text-foreground">
                  Không tìm thấy sự kiện phù hợp
                </h3>
                <p className="text-xs text-muted-foreground">
                  Không có sự kiện nào khớp với các bộ lọc bạn đã chọn. Vui lòng
                  thử từ khóa khác hoặc xóa bộ lọc.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md border border-border bg-background text-xs font-semibold text-foreground hover:bg-secondary transition-colors cursor-pointer"
              >
                Xóa tất cả bộ lọc
              </button>
            </div>
          )}

        {/* Normal Data Table (P0: fits container at 1280px & 1440px; sticky columns below 1024px) */}
        {previewState === "NORMAL" && paginatedEvents.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs table-fixed">
              <colgroup>
                {/* Sự kiện: Flexible ~32% */}
                <col className="w-[32%] min-w-[240px]" />
                {/* Địa điểm: ~20% */}
                <col className="w-[20%] min-w-[160px]" />
                {/* Vé đã bán: ~18% */}
                <col className="w-[18%] min-w-[150px]" />
                {/* Doanh thu: ~14% */}
                <col className="w-[14%] min-w-[120px]" />
                {/* Trạng thái: ~11% */}
                <col className="w-[11%] min-w-[110px]" />
                {/* Thao tác: fixed 56px */}
                <col className="w-[5%] min-w-[56px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                  <th
                    scope="col"
                    className="py-3 px-4 sticky left-0 bg-muted z-10 lg:static lg:bg-transparent"
                  >
                    Sự kiện
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Địa điểm
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Vé đã bán
                  </th>
                  <th scope="col" className="py-3 px-4 text-right">
                    Doanh thu
                  </th>
                  <th scope="col" className="py-3 px-4 whitespace-nowrap">
                    Trạng thái
                  </th>
                  <th
                    scope="col"
                    className="py-3 px-4 text-right sticky right-0 bg-muted z-10 lg:static lg:bg-transparent"
                  >
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedEvents.map((event) => {
                  const displayStatus = getDisplayStatus(event);
                  const StatusIcon = getStatusIcon(displayStatus.key);
                  const soldPercent =
                    event.ticketsTotal > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (event.ticketsSold / event.ticketsTotal) * 100,
                          ),
                        )
                      : 0;

                  return (
                    <tr
                      key={event.id}
                      onClick={() => router.push(`/events/${event.slug}`)}
                      className="hover:bg-secondary/40 transition-colors cursor-pointer group"
                    >
                      {/* Sự kiện (Thumbnail or ImagePlaceholder, Name with tooltip, Date/Time) */}
                      <td className="py-3.5 px-4 sticky left-0 bg-background group-hover:bg-muted/80 transition-colors z-10 lg:static lg:bg-transparent">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative size-11 rounded-md overflow-hidden bg-secondary border border-border shrink-0">
                            {event.bannerUrl ? (
                              <Image
                                src={event.bannerUrl}
                                alt=""
                                fill
                                sizes="44px"
                                className="object-cover"
                              />
                            ) : (
                              <ImagePlaceholder
                                type="event"
                                category={event.category}
                                className="size-full"
                                iconClassName="size-4"
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4
                              className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate"
                              title={event.title}
                            >
                              {event.title}
                            </h4>
                            <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5 truncate">
                              {formatDateTimeVi(event.startTime)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Địa điểm (Venue + City) */}
                      <td className="py-3.5 px-4">
                        <p
                          className="text-xs font-medium text-foreground truncate"
                          title={event.venueName}
                        >
                          {event.venueName}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {event.city}
                        </p>
                      </td>

                      {/* Vé đã bán (Line 1: single line count; Line 2: fixed progress bar + % label) */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-foreground tabular-nums whitespace-nowrap">
                            {formatNumberVi(event.ticketsSold)} /{" "}
                            {formatNumberVi(event.ticketsTotal)}
                          </div>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-1.5 flex-1 bg-secondary rounded-full overflow-hidden"
                              role="progressbar"
                              aria-valuenow={soldPercent}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <div
                                className="h-full bg-primary transition-all duration-300"
                                style={{ width: `${soldPercent}%` }}
                              />
                            </div>
                            <span className="text-[10.5px] text-muted-foreground tabular-nums shrink-0 font-medium">
                              {soldPercent}%
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Doanh thu (Base UI font, tabular-nums, right-aligned, whitespace-nowrap) */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="font-semibold text-foreground tabular-nums text-xs">
                          {formatVnd(event.revenue)}
                        </span>
                      </td>

                      {/* Trạng thái (Pill with icon, label, semantic token, whitespace-nowrap, never clipped) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${displayStatus.badgeClass}`}
                        >
                          <StatusIcon className="size-3 shrink-0" />
                          <span>{displayStatus.label}</span>
                        </span>
                      </td>

                      {/* Thao tác: Fixed 56px actions cell with ⋯ menu */}
                      <td
                        className="py-3.5 px-4 text-right sticky right-0 bg-background group-hover:bg-muted/80 transition-colors z-10 lg:static lg:bg-transparent"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="relative inline-flex items-center justify-end">
                          <button
                            type="button"
                            aria-label={`Tùy chọn cho sự kiện ${event.title}`}
                            aria-haspopup="true"
                            aria-expanded={activeMenuId === event.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId((curr) =>
                                curr === event.id ? null : event.id,
                              );
                            }}
                            className="size-8 rounded-md border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>

                          {activeMenuId === event.id && (
                            <div
                              ref={menuContainerRef}
                              role="menu"
                              className="absolute right-0 top-full mt-1 w-48 rounded-md border border-border bg-popover text-popover-foreground shadow-lg py-1 z-30 text-left text-xs"
                            >
                              {/* Quick primary action if draft */}
                              {event.status === EventStatus.DRAFT && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    await publishOrganizerEvent(event.id);
                                    router.refresh();
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary text-primary font-semibold transition-colors cursor-pointer"
                                >
                                  <CheckCircle2 className="size-3.5 text-primary" />
                                  <span>Phát hành ngay</span>
                                </button>
                              )}

                              <button
                                type="button"
                                role="menuitem"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                  router.push(`/events/${event.slug}`);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary text-foreground transition-colors cursor-pointer"
                              >
                                <Eye className="size-3.5 text-muted-foreground" />
                                <span>Xem chi tiết</span>
                              </button>

                              <button
                                type="button"
                                role="menuitem"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                  router.push(`/events/${event.slug}`);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary text-foreground transition-colors cursor-pointer"
                              >
                                <Layers className="size-3.5 text-muted-foreground" />
                                <span>Xem sơ đồ chỗ ngồi</span>
                              </button>

                              {(event.status === EventStatus.DRAFT ||
                                event.status === EventStatus.PENDING_APPROVAL ||
                                event.status === EventStatus.PUBLISHED) && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    router.push(
                                      `/organizer/events/new?edit=${event.id}`,
                                    );
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary text-foreground transition-colors cursor-pointer"
                                >
                                  <Edit className="size-3.5 text-muted-foreground" />
                                  <span>Chỉnh sửa</span>
                                </button>
                              )}

                              <button
                                type="button"
                                role="menuitem"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                  // TODO(contract): POST /api/v1/events/:id/clone
                                  await cloneOrganizerEvent(event.id);
                                  router.refresh();
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary text-foreground transition-colors cursor-pointer"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Nhân bản</span>
                              </button>

                              {event.status === EventStatus.PUBLISHED && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    // TODO(contract): POST /api/v1/events/:id/pause
                                    await pauseOrganizerEvent(event.id);
                                    router.refresh();
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary text-orange-700 transition-colors cursor-pointer"
                                >
                                  <Pause className="size-3.5" />
                                  <span>Tạm dừng bán</span>
                                </button>
                              )}

                              {(event.status === EventStatus.PUBLISHED ||
                                event.status ===
                                  EventStatus.PENDING_APPROVAL) && (
                                <div className="border-t border-border mt-1 pt-1">
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      setActiveMenuId(null);
                                      // TODO(contract): POST /api/v1/events/:id/cancel
                                      await cancelOrganizerEvent(event.id);
                                      router.refresh();
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-destructive/10 text-destructive transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="size-3.5" />
                                    <span>Hủy sự kiện</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Pagination Bar (hide prev/next when only 1 page) */}
        {previewState === "NORMAL" && filteredEvents.length > 0 && (
          <div className="p-3 sm:p-3.5 border-t border-border bg-background flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>
              Hiển thị{" "}
              <strong className="text-foreground tabular-nums">
                {(currentPage - 1) * pageSize + 1}
              </strong>{" "}
              -{" "}
              <strong className="text-foreground tabular-nums">
                {Math.min(currentPage * pageSize, totalItems)}
              </strong>{" "}
              trên tổng số{" "}
              <strong className="text-foreground tabular-nums">
                {totalItems}
              </strong>{" "}
              sự kiện (20 / trang)
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => {
                    const p = Math.max(1, currentPage - 1);
                    setCurrentPage(p);
                    updateUrlParams({ page: p });
                  }}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-border bg-background hover:bg-secondary text-foreground text-xs disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <ChevronLeft className="size-3.5" />
                  <span>Trang trước</span>
                </button>

                <span className="px-2 font-medium tabular-nums text-foreground">
                  {currentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => {
                    const p = Math.min(totalPages, currentPage + 1);
                    setCurrentPage(p);
                    updateUrlParams({ page: p });
                  }}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-border bg-background hover:bg-secondary text-foreground text-xs disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <span>Trang sau</span>
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
