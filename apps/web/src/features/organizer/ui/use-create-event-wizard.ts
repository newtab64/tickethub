"use client";

import type { FormErrors } from "./create-event-wizard-content-helpers";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { type VenueMapKey } from "@/features/venue";
import {
  CURATED_VENUES,
  CURATED_LAYOUT_TEMPLATES,
  type VietnamCity,
  type CuratedVenue,
  type CuratedZoneConfig,
  type CuratedLayoutOption,
} from "@/features/venue";
import { formatTimeVi } from "@/shared/lib/format-vi";
import {
  saveEventDraft,
  getSavedEventDraft,
  clearSavedEventDraft,
} from "../api/draft-storage";
import { type EventDraftData } from "../domain/organizer.types";

/** Trang thai va hanh dong cua man hinh. */
export function useCreateEventWizard() {
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

  return {
    step,
    setStep,
    savedAtTime,
    setSavedAtTime,
    isSavingDraft,
    hasDraftBanner,
    setHasDraftBanner,
    pendingDraft,
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
    selectedLayoutKey,
    zones,
    hoveredZoneId,
    setHoveredZoneId,
    isPublished,
    venuePickerRef,
    todayStr,
    handleSelectLayout,
    handleRestoreDraft,
    selectedVenue,
    filteredVenues,
    availableLayouts,
    currentLayoutTemplate,
    errors,
    isValidStep1,
    step1HelperMessage,
    handleZonePriceChange,
    handleZoneCapacityChange,
    handleStepClick,
    handleProceedToStep2,
    handleProceedToStep3,
    handleProceedToStep4,
    handleFinalPublish,
    totalEventCapacity,
    totalProjectedRevenue,
  };
}

export type CreateEventWizard = ReturnType<typeof useCreateEventWizard>;
