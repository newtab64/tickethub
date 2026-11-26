import type {
  CreateVenueDto,
  CreateVenueLayoutDto,
  UpdateVenueDto,
  VenueFilterQueryDto,
} from "@tickethub/shared";

export type { CreateVenueDto, CreateVenueLayoutDto, UpdateVenueDto };
export type VenueFilters = VenueFilterQueryDto;
export type VenueZoneTemplate = CreateVenueLayoutDto["defaultZones"][number];

export interface Venue {
  id: string;
  name: string;
  shortName: string;
  city: string;
  district: string;
  address: string;
  category: string;
  totalCapacity: string;
  thumbnailUrl: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VenueLayout {
  id: string;
  venueId: string;
  name: string;
  categoryName: string;
  description: string | null;
  capacityEstimate: string;
  mapKey: string;
  svgContent: string | null;
  defaultZones: VenueZoneTemplate[];
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VenueListItem extends Venue {
  layoutsCount: number;
}

export interface VenuePage {
  items: VenueListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface VenueDetail extends Venue {
  layouts: VenueLayout[];
}
