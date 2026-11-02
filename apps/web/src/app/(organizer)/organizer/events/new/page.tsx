"use client";

import { useState, useMemo, useEffect, Suspense, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Check,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Search,
  Save,
  Info,
  X,
} from "lucide-react";
import { SeatMap } from "@/components/events/seat-map";
import { type VenueMapKey } from "@/lib/venue-svg.generated";
import {
  CURATED_VENUES,
  CURATED_LAYOUT_TEMPLATES,
  type VietnamCity,
  type CuratedVenue,
  type CuratedZoneConfig,
  type CuratedLayoutOption,
} from "@/lib/curated-venues";
import {
  formatVnd,
  formatTimeVi,
  formatDateTimeVi,
  formatNumberVi,
  saveEventDraft,
  getSavedEventDraft,
  clearSavedEventDraft,
  type EventDraftData,
} from "@/lib/organizer-service";
import { CustomSelect, type SelectOption } from "@/components/ui/custom-select";
import { DatePicker, TimePicker } from "@/components/ui/date-picker";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";

const CITY_TABS: Array<{
  id: VietnamCity | "ALL";
  label: string;
  count: number;
}> = [
  { id: "ALL", label: "Tất cả", count: 11 },
  { id: "TP. Hồ Chí Minh", label: "TP. Hồ Chí Minh", count: 4 },
  { id: "Hà Nội", label: "Hà Nội", count: 4 },
  { id: "Đà Nẵng", label: "Đà Nẵng", count: 3 },
];

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: "Âm nhạc", label: "Âm nhạc" },
  { value: "Thể thao", label: "Thể thao" },
  { value: "Sân khấu & Nghệ thuật", label: "Sân khấu & Nghệ thuật" },
  { value: "Hội thảo & Sự kiện", label: "Hội thảo & Sự kiện" },
  { value: "Khác", label: "Khác" },
];

interface FormErrors {
  title?: string;
  category?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  venue?: string;
}

function CreateEventWizardContent() {
  const router = useRouter();

  // Stepper state: 1 to 4
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Draft autosave status
  const [savedAtTime, setSavedAtTime] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [hasDraftBanner, setHasDraftBanner] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<EventDraftData | null>(null);

  // Step 1: Venue selection (NOTHING preselected)
  const [selectedCity, setSelectedCity] = useState<VietnamCity | "ALL">("ALL");
  const [venueSearch, setVenueSearch] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

  // Step 1: Event basic form fields (EMPTY at start)
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");

  // Touched state for validation feedback
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Step 2: Seating Layout selection
  const [selectedLayoutKey, setSelectedLayoutKey] =
    useState<VenueMapKey>("arena-t-stage");

  // Step 3: Zone Pricing & Capacity
  const [zones, setZones] = useState<CuratedZoneConfig[]>(
    () => CURATED_LAYOUT_TEMPLATES["arena-t-stage"]?.defaultZones ?? [],
  );
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);

  // Step 4: Published state
  const [isPublished, setIsPublished] = useState(false);

  // Venue list container reference for scrolling
  const venuePickerRef = useRef<HTMLDivElement>(null);

  // ISO string for today minDate
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  // Check saved draft on mount cleanly
  useEffect(() => {
    const existing = getSavedEventDraft();
    if (existing && existing.title) {
      const animId = requestAnimationFrame(() => {
        setPendingDraft(existing);
        setHasDraftBanner(true);
      });
      return () => cancelAnimationFrame(animId);
    }
  }, []);

  // Update layout and sync default zones
  const handleSelectLayout = (layoutKey: VenueMapKey) => {
    setSelectedLayoutKey(layoutKey);
    const tmpl = CURATED_LAYOUT_TEMPLATES[layoutKey];
    if (tmpl) {
      setZones(tmpl.defaultZones);
    }
  };

  // Restore draft handler
  const handleRestoreDraft = () => {
    if (!pendingDraft) return;
    setTitle(pendingDraft.title || "");
    setCategory(pendingDraft.category || "");
    if (pendingDraft.startTime) {
      const d = new Date(pendingDraft.startTime);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
        setStartDate(`${year}-${month}-${day}`);
        setStartTime(`${hours}:${minutes}`);
      }
    }
    if (pendingDraft.endTime) {
      const d = new Date(pendingDraft.endTime);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
        setEndDate(`${year}-${month}-${day}`);
        setEndTime(`${hours}:${minutes}`);
      }
    }
    if (pendingDraft.venueId) {
      setSelectedVenueId(pendingDraft.venueId);
    }
    setSavedAtTime(formatTimeVi(pendingDraft.savedAt));
    setHasDraftBanner(false);
  };

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const isDirty = Boolean(title || selectedVenueId || startDate);
      if (isDirty && !isPublished) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [title, selectedVenueId, startDate, isPublished]);

  // Selected venue object
  const selectedVenue = useMemo<CuratedVenue | null>(() => {
    if (!selectedVenueId) return null;
    return CURATED_VENUES.find((v) => v.id === selectedVenueId) || null;
  }, [selectedVenueId]);

  // Filtered venues based on city and search keyword
  const filteredVenues = useMemo(() => {
    return CURATED_VENUES.filter((venue) => {
      const matchCity = selectedCity === "ALL" || venue.city === selectedCity;
      const q = venueSearch.trim().toLowerCase();
      const matchSearch =
        q === "" ||
        venue.name.toLowerCase().includes(q) ||
        venue.shortName.toLowerCase().includes(q) ||
        venue.district.toLowerCase().includes(q) ||
        venue.address.toLowerCase().includes(q);
      return matchCity && matchSearch;
    });
  }, [selectedCity, venueSearch]);

  // Available layouts for chosen venue
  const availableLayouts = useMemo<CuratedLayoutOption[]>(() => {
    if (!selectedVenue) return [];
    return selectedVenue.layouts;
  }, [selectedVenue]);

  // Active layout template
  const currentLayoutTemplate = useMemo(() => {
    return (
      CURATED_LAYOUT_TEMPLATES[selectedLayoutKey] ||
      CURATED_LAYOUT_TEMPLATES["arena-t-stage"]
    );
  }, [selectedLayoutKey]);

  // Inline Validation Rules (start not in past, end after start, plain Vietnamese)
  const errors = useMemo<FormErrors>(() => {
    const errs: FormErrors = {};

    if (!title.trim()) {
      errs.title = "Vui lòng nhập tên sự kiện.";
    } else if (title.trim().length < 5) {
      errs.title = "Tên sự kiện phải có ít nhất 5 ký tự.";
    }

    if (!category) {
      errs.category = "Vui lòng chọn thể loại sự kiện.";
    }

    if (!startDate) {
      errs.startDate = "Vui lòng chọn ngày bắt đầu.";
    }

    if (!startTime) {
      errs.startTime = "Vui lòng chọn giờ bắt đầu.";
    }

    // Start not in the past
    if (startDate && startTime) {
      const startDateTime = new Date(`${startDate}T${startTime}`);
      const now = new Date();
      if (
        !isNaN(startDateTime.getTime()) &&
        startDateTime.getTime() < now.getTime()
      ) {
        errs.startDate = "Thời gian bắt đầu không được ở trong quá khứ.";
      }
    }

    // End must be after start
    if (endDate && endTime && startDate && startTime) {
      const startDateTime = new Date(`${startDate}T${startTime}`);
      const endDateTime = new Date(`${endDate}T${endTime}`);
      if (!isNaN(startDateTime.getTime()) && !isNaN(endDateTime.getTime())) {
        if (endDateTime.getTime() <= startDateTime.getTime()) {
          errs.endDate =
            "Thời gian kết thúc phải diễn ra sau thời gian bắt đầu.";
        }
      }
    }

    if (!selectedVenueId) {
      errs.venue = "Vui lòng chọn một địa điểm tổ chức.";
    }

    return errs;
  }, [
    title,
    category,
    startDate,
    startTime,
    endDate,
    endTime,
    selectedVenueId,
  ]);

  const isValidStep1 =
    Boolean(title.trim().length >= 5) &&
    Boolean(category) &&
    Boolean(startDate) &&
    Boolean(startTime) &&
    Boolean(selectedVenueId) &&
    !errors.startDate &&
    !errors.endDate;

  // Helper text explaining what is missing
  const step1HelperMessage = useMemo(() => {
    if (isValidStep1) return "";
    const missing: string[] = [];
    if (!selectedVenueId) missing.push("chọn địa điểm");
    if (!title.trim() || title.trim().length < 5)
      missing.push("tên sự kiện (≥5 ký tự)");
    if (!category) missing.push("thể loại");
    if (!startDate || !startTime) missing.push("thời gian bắt đầu");
    if (errors.startDate) missing.push(errors.startDate);
    if (errors.endDate) missing.push(errors.endDate);

    return `Vui lòng hoàn thành: ${missing.join(", ")} để tiếp tục.`;
  }, [
    isValidStep1,
    selectedVenueId,
    title,
    category,
    startDate,
    startTime,
    errors.startDate,
    errors.endDate,
  ]);

  // Debounced Autosave to localStorage
  useEffect(() => {
    if (!title && !selectedVenueId) return;

    const timer = setTimeout(() => {
      setIsSavingDraft(true);
      const startIso =
        startDate && startTime ? `${startDate}T${startTime}:00Z` : "";
      const endIso =
        endDate && endTime ? `${endDate}T${endTime}:00Z` : undefined;

      const res = saveEventDraft({
        title,
        category,
        startTime: startIso,
        endTime: endIso,
        venueId: selectedVenue?.id,
        venueName: selectedVenue?.name,
        venueAddress: selectedVenue?.address,
        city: selectedVenue?.city,
      });

      setSavedAtTime(formatTimeVi(res.savedAt));
      setIsSavingDraft(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [
    title,
    category,
    startDate,
    startTime,
    endDate,
    endTime,
    selectedVenue,
    selectedVenueId,
  ]);

  // Update Zone Price handler
  const handleZonePriceChange = (zoneId: string, newPrice: number) => {
    setZones((prev) =>
      prev.map((z) =>
        z.zoneId === zoneId ? { ...z, price: Math.max(0, newPrice) } : z,
      ),
    );
  };

  // Update Zone Capacity handler
  const handleZoneCapacityChange = (zoneId: string, newCap: number) => {
    setZones((prev) =>
      prev.map((z) =>
        z.zoneId === zoneId ? { ...z, capacity: Math.max(1, newCap) } : z,
      ),
    );
  };

  // Step click handler (only completed steps are clickable)
  const handleStepClick = (targetStep: 1 | 2 | 3 | 4) => {
    if (targetStep < step) {
      setStep(targetStep);
    }
  };

  // Step 1 to Step 2
  const handleProceedToStep2 = () => {
    if (!isValidStep1) {
      setTouched({
        title: true,
        category: true,
        startDate: true,
        startTime: true,
        venue: true,
      });
      return;
    }
    // Set default layout to first layout of chosen venue
    if (availableLayouts.length > 0 && availableLayouts[0]) {
      handleSelectLayout(availableLayouts[0].mapKey);
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Step 2 to Step 3
  const handleProceedToStep3 = () => {
    setStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Step 3 to Step 4
  const handleProceedToStep4 = () => {
    setStep(4);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Final Publish Handler
  const handleFinalPublish = () => {
    setIsPublished(true);
    clearSavedEventDraft();
    // Simulate API delay
    setTimeout(() => {
      router.push("/organizer/events");
    }, 1200);
  };

  // Computed summary for Step 4
  const totalEventCapacity = useMemo(
    () => zones.reduce((sum, z) => sum + z.capacity, 0),
    [zones],
  );
  const totalProjectedRevenue = useMemo(
    () => zones.reduce((sum, z) => sum + z.capacity * z.price, 0),
    [zones],
  );

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Draft Notification Banner */}
      {hasDraftBanner && pendingDraft && (
        <div
          role="region"
          aria-label="Thông báo bản nháp"
          className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-background text-xs text-foreground shadow-2xs"
        >
          <div className="flex items-center gap-2.5">
            <Info className="size-4 text-primary shrink-0" />
            <p>
              Bạn có một bản nháp chưa hoàn tất:{" "}
              <strong className="font-semibold text-foreground">
                &quot;{pendingDraft.title || "Sự kiện chưa đặt tên"}&quot;
              </strong>{" "}
              được lưu lúc {formatDateTimeVi(pendingDraft.savedAt)}.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Khôi phục bản nháp
            </button>
            <button
              type="button"
              onClick={() => {
                setHasDraftBanner(false);
                clearSavedEventDraft();
              }}
              className="h-7 px-2.5 rounded-md border border-border text-muted-foreground hover:text-foreground text-xs transition-colors cursor-pointer"
            >
              Bỏ qua
            </button>
          </div>
        </div>
      )}

      {/* 1. Header & Stepper */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Tạo sự kiện
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Thiết lập địa điểm, sơ đồ chỗ ngồi và cấu hình giá vé cho sự kiện
              mới.
            </p>
          </div>

          {/* Draft Autosave Indicator */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground self-start sm:self-auto">
            {isSavingDraft ? (
              <span className="flex items-center gap-1.5 font-medium">
                <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                Đang lưu nháp...
              </span>
            ) : savedAtTime ? (
              <span className="flex items-center gap-1.5 text-foreground font-medium">
                <Check className="size-3.5 text-primary" />
                Đã lưu nháp lúc {savedAtTime}
              </span>
            ) : (
              <span>Chưa lưu nháp</span>
            )}
          </div>
        </div>

        {/* Stepper: Compact cards, readable contrast (>= 4.5:1) while muted */}
        <nav aria-label="Các bước thiết lập sự kiện" className="w-full">
          <ol className="grid grid-cols-4 gap-2 sm:gap-3">
            {[
              { num: 1, title: "Thông tin & Địa điểm" },
              { num: 2, title: "Sơ đồ chỗ ngồi" },
              { num: 3, title: "Hạng vé & Giá bán" },
              { num: 4, title: "Xem trước & Xuất bản" },
            ].map((s) => {
              const isCompleted = s.num < step;
              const isCurrent = s.num === step;
              const isFuture = s.num > step;

              return (
                <li key={s.num} className="relative">
                  <button
                    type="button"
                    disabled={isFuture}
                    onClick={() => handleStepClick(s.num as 1 | 2 | 3 | 4)}
                    className={`w-full text-left p-2 sm:p-2.5 rounded-lg border transition-all ${
                      isCurrent
                        ? "border-primary bg-background shadow-2xs"
                        : isCompleted
                          ? "border-border bg-background hover:bg-secondary/40 cursor-pointer"
                          : "border-border/80 bg-secondary/30 text-foreground cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5">
                      <div
                        className={`size-6 sm:size-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isCompleted
                            ? "bg-primary text-primary-foreground"
                            : isCurrent
                              ? "border-2 border-primary text-primary bg-background"
                              : "bg-secondary text-foreground border border-border"
                        }`}
                      >
                        {isCompleted ? <Check className="size-3.5" /> : s.num}
                      </div>
                      <div className="min-w-0 flex-1 hidden sm:block">
                        <p className="text-[10px] text-muted-foreground leading-tight font-medium">
                          Bước {s.num}
                        </p>
                        <p
                          className={`text-xs truncate ${
                            isCurrent
                              ? "font-bold text-foreground"
                              : isCompleted
                                ? "font-medium text-foreground"
                                : "font-medium text-foreground/80"
                          }`}
                        >
                          {s.title}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      {/* ========================================================
          STEP 1: Thông tin & Địa điểm (Desktop 2 Columns)
          ======================================================== */}
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

      {/* ========================================================
          STEP 2: Chọn Sơ Đồ Chỗ Ngồi
          ======================================================== */}
      {step === 2 && selectedVenue && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Chọn mẫu sơ đồ chỗ ngồi
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Địa điểm:{" "}
                <strong className="text-foreground">
                  {selectedVenue.name}
                </strong>{" "}
                • {selectedVenue.city}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-semibold cursor-pointer"
            >
              <ArrowLeft className="size-3.5" />
              <span>Quay lại thông tin sự kiện</span>
            </button>
          </div>

          {/* Layout Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableLayouts.map((layout) => {
              const isSelected = selectedLayoutKey === layout.mapKey;

              return (
                <div
                  key={layout.id}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onClick={() => handleSelectLayout(layout.mapKey)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectLayout(layout.mapKey);
                    }
                  }}
                  className={`p-4 rounded-lg border bg-background transition-all text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring relative ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/20 bg-accent/20"
                      : "border-border hover:border-foreground/40"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3 size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="size-3" />
                    </div>
                  )}

                  <div className="space-y-2">
                    <div>
                      <span className="text-[11px] font-semibold text-primary">
                        {layout.categoryName}
                      </span>
                      <h3 className="text-base font-bold text-foreground mt-0.5">
                        {layout.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {layout.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Sức chứa ước tính:{" "}
                        <strong className="text-foreground font-semibold">
                          {layout.capacityEstimate}
                        </strong>
                      </span>
                      <span>{layout.defaultZones.length} phân khu giá</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md border border-border bg-background hover:bg-secondary text-foreground text-sm font-medium transition-colors cursor-pointer"
            >
              <ArrowLeft className="size-4" />
              <span>Quay lại</span>
            </button>

            <button
              type="button"
              onClick={handleProceedToStep3}
              className="inline-flex items-center gap-1.5 h-10 px-5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>Tiếp tục: Cấu hình hạng vé</span>
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          STEP 3: Hạng vé & Giá bán (Split-View SeatMap + Table)
          ======================================================== */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Cấu hình phân khu &amp; đơn giá
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Thiết lập mức giá và số lượng vé cho từng khán đài. Rê chuột lên
                sơ đồ hoặc bảng để đối soát.
              </p>
            </div>
            <div className="text-xs text-muted-foreground">
              Sơ đồ:{" "}
              <strong className="text-foreground">
                {currentLayoutTemplate.name}
              </strong>
            </div>
          </div>

          {/* Split-View Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Interactive SeatMap */}
            <div className="lg:col-span-6 rounded-lg border border-border bg-background p-4 space-y-3 lg:sticky lg:top-20">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  Sơ đồ chỗ ngồi tương tác
                </span>
                <span>Di chuột để xem vị trí</span>
              </div>

              <div className="relative aspect-[4/3] w-full rounded-md border border-border/60 bg-muted/20 overflow-hidden flex items-center justify-center">
                <SeatMap
                  mapKey={selectedLayoutKey}
                  hoveredZoneId={hoveredZoneId}
                  onSelectZone={() => {}}
                  onHoverZone={(zoneId: string | null) =>
                    setHoveredZoneId(zoneId)
                  }
                  zoneInfoMap={zones.reduce<
                    Record<
                      string,
                      { name: string; minPrice: number; count: number }
                    >
                  >((acc, z) => {
                    acc[z.zoneId] = {
                      name: z.name,
                      minPrice: z.price,
                      count: z.capacity,
                    };
                    return acc;
                  }, {})}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                <span>Trạng thái: Khán đài đã tối ưu tỷ lệ</span>
                <span className="tabular-nums font-medium text-foreground">
                  {zones.length} khu vực hoạt động
                </span>
              </div>
            </div>

            {/* Right: Zone Config Table (No monospace; base UI font with tabular-nums) */}
            <div className="lg:col-span-6 space-y-3">
              <div className="rounded-lg border border-border bg-background overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                      <th className="py-2.5 px-3">Phân khu</th>
                      <th className="py-2.5 px-3 w-36">Đơn giá (VNĐ)</th>
                      <th className="py-2.5 px-3 w-28 text-right">Số lượng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {zones.map((zone) => {
                      const isHovered = hoveredZoneId === zone.zoneId;

                      return (
                        <tr
                          key={zone.zoneId}
                          onMouseEnter={() => setHoveredZoneId(zone.zoneId)}
                          onMouseLeave={() => setHoveredZoneId(null)}
                          className={`transition-colors ${
                            isHovered
                              ? "bg-accent/40 font-semibold"
                              : "hover:bg-secondary/40"
                          }`}
                        >
                          <td className="py-3 px-3">
                            <div className="space-y-0.5">
                              <span className="font-bold text-foreground">
                                {zone.name}
                              </span>
                              <p className="text-[11px] text-muted-foreground">
                                Mã phân khu: {zone.zoneId} •{" "}
                                {zone.isSeated ? "Ghế ngồi có số" : "Khu đứng"}
                              </p>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <input
                              type="number"
                              min={0}
                              step={50000}
                              value={zone.price}
                              onChange={(e) =>
                                handleZonePriceChange(
                                  zone.zoneId,
                                  parseInt(e.target.value, 10) || 0,
                                )
                              }
                              className="w-full h-8 px-2.5 rounded-md border border-input bg-background text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring tabular-nums"
                            />
                            <span className="text-[10.5px] text-muted-foreground tabular-nums block mt-0.5">
                              {formatVnd(zone.price)}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <input
                              type="number"
                              min={10}
                              step={50}
                              value={zone.capacity}
                              onChange={(e) =>
                                handleZoneCapacityChange(
                                  zone.zoneId,
                                  parseInt(e.target.value, 10) || 10,
                                )
                              }
                              className="w-24 h-8 px-2.5 rounded-md border border-input bg-background text-xs text-right text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring tabular-nums inline-block"
                            />
                            <span className="text-[10.5px] text-muted-foreground tabular-nums block mt-0.5">
                              vé
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary (Base UI font, tabular-nums) */}
              <div className="p-3.5 rounded-lg border border-border bg-background flex items-center justify-between text-xs">
                <div>
                  <span className="text-muted-foreground">
                    Tổng số vé phát hành:
                  </span>{" "}
                  <strong className="text-foreground tabular-nums font-semibold">
                    {formatNumberVi(totalEventCapacity)}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    Doanh thu dự kiến:
                  </span>{" "}
                  <strong className="text-foreground tabular-nums font-bold">
                    {formatVnd(totalProjectedRevenue)}
                  </strong>
                </div>
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md border border-border bg-background hover:bg-secondary text-foreground text-sm font-medium transition-colors cursor-pointer"
                >
                  <ArrowLeft className="size-4" />
                  <span>Quay lại</span>
                </button>

                <button
                  type="button"
                  onClick={handleProceedToStep4}
                  className="inline-flex items-center gap-1.5 h-10 px-5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span>Tiếp tục: Xem trước sự kiện</span>
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          STEP 4: Xem Trước & Xuất Bản
          ======================================================== */}
      {step === 4 && selectedVenue && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-foreground">
              Xem trước và xuất bản sự kiện
            </h2>
            <p className="text-xs text-muted-foreground">
              Vui lòng rà soát lại thông tin trước khi phát hành sự kiện lên
              TicketHub.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-background p-6 space-y-5 shadow-2xs">
            {/* Header info */}
            <div className="space-y-1 pb-4 border-b border-border">
              <span className="text-xs font-semibold text-primary">
                {category}
              </span>
              <h3 className="text-lg font-bold text-foreground">{title}</h3>
              <p className="text-xs text-muted-foreground tabular-nums">
                Thời gian: {formatDateTimeVi(`${startDate}T${startTime}`)}
                {endDate &&
                  endTime &&
                  ` - ${formatDateTimeVi(`${endDate}T${endTime}`)}`}
              </p>
            </div>

            {/* Venue & Layout */}
            <div className="grid grid-cols-2 gap-4 text-xs pb-4 border-b border-border">
              <div>
                <span className="text-muted-foreground block text-[11px]">
                  Địa điểm
                </span>
                <strong className="text-foreground text-xs">
                  {selectedVenue.name}
                </strong>
                <p className="text-muted-foreground text-[11.5px] mt-0.5">
                  {selectedVenue.address}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">
                  Sơ đồ chỗ ngồi
                </span>
                <strong className="text-foreground text-xs">
                  {currentLayoutTemplate.name}
                </strong>
                <p className="text-muted-foreground text-[11.5px] mt-0.5">
                  {currentLayoutTemplate.categoryName}
                </p>
              </div>
            </div>

            {/* Ticket Breakdown (Base UI font, tabular-nums) */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-foreground">
                Cấu hình các phân khu vé
              </span>
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                      <th className="py-2 px-3">Hạng vé</th>
                      <th className="py-2 px-3 text-right">Đơn giá</th>
                      <th className="py-2 px-3 text-right">Số lượng</th>
                      <th className="py-2 px-3 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {zones.map((z) => (
                      <tr key={z.zoneId} className="hover:bg-secondary/40">
                        <td className="py-2 px-3 font-medium text-foreground">
                          {z.name}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-medium">
                          {formatVnd(z.price)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-medium">
                          {formatNumberVi(z.capacity)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-semibold text-foreground">
                          {formatVnd(z.capacity * z.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-muted/30 font-bold text-foreground">
                      <td className="py-2.5 px-3">Tổng cộng</td>
                      <td className="py-2.5 px-3" />
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {formatNumberVi(totalEventCapacity)} vé
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-primary font-bold">
                        {formatVnd(totalProjectedRevenue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md border border-border bg-background hover:bg-secondary text-foreground text-sm font-medium transition-colors cursor-pointer"
              >
                <ArrowLeft className="size-4" />
                <span>Quay lại cấu hình</span>
              </button>

              <button
                type="button"
                onClick={handleFinalPublish}
                disabled={isPublished}
                className="inline-flex items-center gap-2 h-10 px-6 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-colors shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {isPublished ? (
                  <>
                    <Check className="size-4" />
                    <span>Đang phát hành...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    <span>Xuất bản sự kiện</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sticky Bottom Action Bar for Step 1 */}
      {step === 1 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 p-3.5 border-t border-border bg-background/95 backdrop-blur-xs shadow-lg space-y-1.5">
          <button
            type="button"
            disabled={!isValidStep1}
            onClick={handleProceedToStep2}
            className="w-full h-11 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Tiếp tục: Chọn sơ đồ chỗ ngồi</span>
            <ArrowRight className="size-4" />
          </button>
          {!isValidStep1 && (
            <p className="text-[11px] text-muted-foreground text-center truncate">
              {step1HelperMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function CreateEventWizardPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1200px] mx-auto px-4 py-8 text-xs text-muted-foreground">
          Đang tải trang tạo sự kiện...
        </div>
      }
    >
      <CreateEventWizardContent />
    </Suspense>
  );
}
