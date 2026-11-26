import type {
  CreateVenueDto,
  CreateVenueLayoutDto,
  UpdateVenueDto,
  Venue,
  VenueFilters,
  VenueLayout,
  VenuePage,
} from "./venue.models";

export interface VenueRepository {
  /** Danh sach dia diem dang hoat dong kem so luong so do, da phan trang. */
  search(
    filters: VenueFilters,
    page: number,
    limit: number,
  ): Promise<VenuePage>;
  findActiveById(id: string): Promise<Venue | null>;
  listActiveLayouts(venueId: string): Promise<VenueLayout[]>;
  create(dto: CreateVenueDto): Promise<Venue>;
  /** Tra ve null neu dia diem khong ton tai. */
  update(id: string, dto: UpdateVenueDto): Promise<Venue | null>;
  /** Neu layout moi la mac dinh, bo co mac dinh cua cac layout cu cua cung dia diem. */
  addLayout(venueId: string, dto: CreateVenueLayoutDto): Promise<VenueLayout>;
}

/** Cache doc-qua (read-through). Moi loi ha tang duoc nuot, khong lam hong luong chinh. */
export interface VenueReadCache {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  invalidate(venueId?: string): Promise<void>;
}
