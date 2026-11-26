export type VenueErrorCode = "VENUE_NOT_FOUND";

/** Loi nghiep vu cua context Venue, khong phu thuoc HTTP. */
export class VenueDomainError extends Error {
  constructor(
    readonly code: VenueErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "VenueDomainError";
  }
}

export const venueErrors = {
  notFound: () =>
    new VenueDomainError("VENUE_NOT_FOUND", "Không tìm thấy địa điểm tổ chức"),
  notFoundForUpdate: () =>
    new VenueDomainError(
      "VENUE_NOT_FOUND",
      "Không tìm thấy địa điểm tổ chức để cập nhật",
    ),
};
