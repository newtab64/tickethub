import type { EventStatus } from "@tickethub/shared";

export interface OrganizerEventItem {
  id: string;
  title: string;
  slug: string;
  category: string;
  bannerUrl: string;
  venueId?: string;
  venueName: string;
  venueAddress: string;
  city: string;
  startTime: string; // ISO 8601
  endTime?: string; // ISO 8601
  status: EventStatus;
  ticketsSold: number;
  ticketsTotal: number;
  revenue: number; // in VND
  version: number;
  rejectionReason?: string;
}

export interface OrganizerMetrics {
  totalSoldTickets: number;
  totalRevenue: number;
  upcomingEventsCount: number;
  actionRequiredCount: number;
}

export interface OrganizerEventsQuery {
  keyword?: string;
  status?: EventStatus | "ALL" | "ACTION_REQUIRED";
  city?: string;
  fromDate?: string;
  toDate?: string;
  sort?: "date_asc" | "date_desc" | "title_asc" | "revenue_desc" | "sold_desc";
  cursor?: string;
  limit?: number;
}

export interface OrganizerEventsResponse {
  items: OrganizerEventItem[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

export interface EventDraftData {
  id?: string;
  title: string;
  category: string;
  startTime: string;
  endTime?: string;
  venueId?: string;
  venueName?: string;
  venueAddress?: string;
  city?: string;
  savedAt: string; // ISO 8601
}

export type OrganizerVerificationStatus =
  "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";

export interface OrganizerProfile {
  id: string;
  userId?: string;
  organizationName: string;
  taxCode: string;
  phone: string;
  email: string;
  address: string;
  representativeName: string;
  businessLicenseUrl?: string;
  status: OrganizerVerificationStatus;
  rejectionReason?: string;
  updatedAt: string;
}
