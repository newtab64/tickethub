"use client";

import Image from "next/image";
import { Check, ArrowRight, Search, Save, X } from "lucide-react";
import { formatTimeVi, formatDateTimeVi } from "@/shared/lib/format-vi";
import { saveEventDraft } from "../api/draft-storage";
import { CustomSelect } from "@/shared/ui/custom-select";
import { DatePicker, TimePicker } from "@/shared/ui/date-picker";
import { ImagePlaceholder } from "@/shared/ui/image-placeholder";
import type { CreateEventWizard } from "./use-create-event-wizard";
import {
  CITY_TABS,
  CATEGORY_OPTIONS,
} from "./create-event-wizard-content-helpers";

/** Khoi giao dien: wizard-step-1. */
export function WizardStep1({ vm }: { vm: CreateEventWizard }) {
  const {
    step,
    setSavedAtTime,
    selectedCity,
    setSelectedCity,
    venueSearch,
    setVenueSearch,
    selectedVenueId,
    setSelectedVenueId,
    title,
    setTitle,
    category,
    setCategory,
    startDate,
    setStartDate,
    startTime,
    setStartTime,
    endDate,
    setEndDate,
    endTime,
    setEndTime,
    touched,
    setTouched,
    venuePickerRef,
    todayStr,
    selectedVenue,
    filteredVenues,
    errors,
    isValidStep1,
    step1HelperMessage,
    handleProceedToStep2,
  } = vm;

  return (
    <>
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Venue Picker (7 columns, compact horizontal cards) */}
          <div ref={venuePickerRef} className="lg:col-span-7 space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-foreground">
                Chọn địa điểm
              </h2>
              <p className="text-xs text-muted-foreground">
                Lựa chọn nhà thi đấu, sân vận động hoặc nhà hát đã chuẩn hóa sơ
                đồ.
              </p>
            </div>

            {/* City Tabs with counts */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {CITY_TABS.map((tab) => {
                const active = selectedCity === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedCity(tab.id)}
                    className={`h-8 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? "bg-foreground text-background"
                        : "bg-background border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                );
              })}
            </div>

            {/* Venue Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={venueSearch}
                onChange={(e) => setVenueSearch(e.target.value)}
                placeholder="Tìm kiếm địa điểm theo tên, quận huyện, địa chỉ..."
                className="w-full h-10 pl-9 pr-8 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {venueSearch && (
                <button
                  type="button"
                  onClick={() => setVenueSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Compact Horizontal Venue Cards Grid (All 11 fit in ~1 scroll at 1280px) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredVenues.map((venue) => {
                const isSelected = selectedVenueId === venue.id;

                return (
                  <div
                    key={venue.id}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={() => {
                      setSelectedVenueId(venue.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedVenueId(venue.id);
                      }
                    }}
                    className={`flex items-center rounded-lg border bg-background overflow-hidden transition-all text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring relative group h-24 ${
                      isSelected
                        ? "border-primary bg-accent/20"
                        : "border-border hover:border-foreground/30 hover:bg-secondary/20"
                    }`}
                  >
                    {/* Selected Checkmark Badge */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 z-10 size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                        <Check className="size-3" />
                      </div>
                    )}

                    {/* Left Thumbnail ~96px */}
                    <div className="relative w-24 h-full bg-secondary shrink-0 overflow-hidden border-r border-border">
                      {venue.thumbnailUrl ? (
                        <Image
                          src={venue.thumbnailUrl}
                          alt=""
                          fill
                          sizes="96px"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <ImagePlaceholder
                          type="venue"
                          category={venue.category}
                          className="size-full"
                          iconClassName="size-5"
                        />
                      )}
                    </div>

                    {/* Right Info: 2 lines name with tooltip, district+city, capacity & N sơ đồ */}
                    <div className="p-2.5 min-w-0 flex-1 flex flex-col justify-between h-full">
                      <div>
                        <h3
                          className="text-xs font-bold text-foreground leading-snug line-clamp-2 pr-6"
                          title={venue.name}
                        >
                          {venue.name}
                        </h3>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {venue.district}, {venue.city}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground tabular-nums">
                        <span className="font-semibold text-foreground">
                          {venue.totalCapacity}
                        </span>
                        <span aria-hidden="true">•</span>
                        <span>{venue.layouts.length} sơ đồ</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredVenues.length === 0 && (
              <div className="p-8 text-center border border-dashed border-border rounded-lg text-xs text-muted-foreground">
                Không tìm thấy địa điểm nào phù hợp với từ khóa &quot;
                {venueSearch}&quot;.
              </div>
            )}
          </div>

          {/* Right Column: Sticky Panel with Derived Info & Form (5 columns) */}
          <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
            <div className="rounded-lg border border-border bg-background p-5 space-y-5 shadow-2xs">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Thông tin sự kiện
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Điền các thông tin cơ bản trước khi chọn sơ đồ chỗ ngồi.
                </p>
              </div>

              {/* Read-Only Derived Venue Information */}
              <div className="rounded-md border border-border bg-muted/30 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">
                    Địa điểm đã chọn
                  </span>
                  {selectedVenue && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVenueId(null);
                        venuePickerRef.current?.scrollIntoView({
                          behavior: "smooth",
                        });
                      }}
                      className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                    >
                      Đổi địa điểm
                    </button>
                  )}
                </div>

                {selectedVenue ? (
                  <div className="space-y-1 pt-1">
                    <p className="font-bold text-foreground text-xs">
                      {selectedVenue.name}
                    </p>
                    <p className="text-muted-foreground text-[11.5px] leading-relaxed">
                      {selectedVenue.address}
                    </p>
                    <div className="flex items-center justify-between text-muted-foreground text-[11.5px] pt-1 border-t border-border/50">
                      <span>
                        Thành phố:{" "}
                        <strong className="text-foreground font-semibold">
                          {selectedVenue.city}
                        </strong>
                      </span>
                      <span>
                        Sức chứa:{" "}
                        <strong className="text-foreground font-semibold tabular-nums">
                          {selectedVenue.totalCapacity}
                        </strong>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground py-2 text-center text-xs">
                    Chưa chọn địa điểm. Hãy nhấp vào một địa điểm ở cột bên
                    trái.
                  </div>
                )}
                {touched.venue && errors.venue && (
                  <p className="text-xs text-destructive mt-1 font-medium">
                    {errors.venue}
                  </p>
                )}
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                {/* Tên sự kiện */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="event-title"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Tên sự kiện <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="event-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => setTouched((p) => ({ ...p, title: true }))}
                    placeholder="Ví dụ: Liveshow Âm Nhạc Mùa Thu 2026"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {touched.title && errors.title && (
                    <p className="text-xs text-destructive font-medium">
                      {errors.title}
                    </p>
                  )}
                </div>

                {/* Thể loại (CustomSelect) */}
                <div className="space-y-1.5">
                  <label
                    id="event-category-label"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Thể loại <span className="text-destructive">*</span>
                  </label>
                  <CustomSelect
                    value={category}
                    onChange={(val) => {
                      setCategory(val);
                      setTouched((p) => ({ ...p, category: true }));
                    }}
                    options={CATEGORY_OPTIONS}
                    placeholder="Chọn thể loại"
                    ariaLabel="Chọn thể loại sự kiện"
                  />
                  {touched.category && errors.category && (
                    <p className="text-xs text-destructive font-medium">
                      {errors.category}
                    </p>
                  )}
                </div>

                {/* Thời gian bắt đầu (DatePicker dd/mm/yyyy & TimePicker 24h 15-min) */}
                <div className="space-y-1.5">
                  <span className="block text-xs font-semibold text-foreground">
                    Thời gian bắt đầu{" "}
                    <span className="text-destructive">*</span>
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <DatePicker
                      value={startDate}
                      onChange={(val) => {
                        setStartDate(val);
                        setTouched((p) => ({ ...p, startDate: true }));
                      }}
                      minDate={todayStr}
                      placeholder="dd/mm/yyyy"
                      ariaLabel="Ngày bắt đầu"
                    />
                    <TimePicker
                      value={startTime}
                      onChange={(val) => {
                        setStartTime(val);
                        setTouched((p) => ({ ...p, startTime: true }));
                      }}
                      placeholder="HH:mm"
                      ariaLabel="Giờ bắt đầu"
                    />
                  </div>
                  {startDate && startTime && !errors.startDate && (
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      Bắt đầu: {formatDateTimeVi(`${startDate}T${startTime}`)}
                    </p>
                  )}
                  {touched.startDate && errors.startDate && (
                    <p className="text-xs text-destructive font-medium">
                      {errors.startDate}
                    </p>
                  )}
                  {touched.startTime &&
                    !errors.startDate &&
                    errors.startTime && (
                      <p className="text-xs text-destructive font-medium">
                        {errors.startTime}
                      </p>
                    )}
                </div>

                {/* Thời gian kết thúc (Tùy chọn: DatePicker & TimePicker) */}
                <div className="space-y-1.5">
                  <span className="block text-xs font-semibold text-foreground">
                    Thời gian kết thúc (tùy chọn)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <DatePicker
                      value={endDate}
                      onChange={(val) => {
                        setEndDate(val);
                        setTouched((p) => ({ ...p, endDate: true }));
                      }}
                      minDate={startDate || todayStr}
                      placeholder="dd/mm/yyyy"
                      ariaLabel="Ngày kết thúc"
                    />
                    <TimePicker
                      value={endTime}
                      onChange={(val) => {
                        setEndTime(val);
                        setTouched((p) => ({ ...p, endTime: true }));
                      }}
                      placeholder="HH:mm"
                      ariaLabel="Giờ kết thúc"
                    />
                  </div>
                  {endDate && endTime && !errors.endDate && (
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      Kết thúc: {formatDateTimeVi(`${endDate}T${endTime}`)}
                    </p>
                  )}
                  {errors.endDate && (
                    <p className="text-xs text-destructive font-medium">
                      {errors.endDate}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons & Missing Info Helper Text */}
              <div className="pt-2 space-y-2 border-t border-border">
                <button
                  type="button"
                  disabled={!isValidStep1}
                  onClick={handleProceedToStep2}
                  className="w-full h-10 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-2xs flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span>Tiếp tục: Chọn sơ đồ chỗ ngồi</span>
                  <ArrowRight className="size-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const res = saveEventDraft({
                      title,
                      category,
                      startTime:
                        startDate && startTime
                          ? `${startDate}T${startTime}:00Z`
                          : "",
                      endTime:
                        endDate && endTime
                          ? `${endDate}T${endTime}:00Z`
                          : undefined,
                      venueId: selectedVenue?.id,
                      venueName: selectedVenue?.name,
                      venueAddress: selectedVenue?.address,
                      city: selectedVenue?.city,
                    });
                    setSavedAtTime(formatTimeVi(res.savedAt));
                  }}
                  className="w-full h-9 rounded-md border border-border bg-background hover:bg-secondary text-foreground text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="size-3.5" />
                  <span>Lưu nháp</span>
                </button>

                {/* Helper text explaining what's missing when disabled */}
                {!isValidStep1 && (
                  <p className="text-xs text-muted-foreground text-center pt-1 leading-relaxed">
                    {step1HelperMessage}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
