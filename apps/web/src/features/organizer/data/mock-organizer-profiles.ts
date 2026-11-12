// Du lieu tam: ho so Ban to chuc dung khi backend khong kha dung.
import type { OrganizerProfile } from "../domain/organizer.types";

export const MOCK_ORGANIZER_PROFILES: OrganizerProfile[] = [
  {
    id: "org-01",
    organizationName: "Công ty TNHH Giải Trí & Sự Kiện Sao Việt",
    taxCode: "0312345678",
    phone: "0901234567",
    email: "organizer@tickethub.com",
    address: "19 Nguyễn Hữu Thọ, Phường Tân Phong, Quận 7, TP. Hồ Chí Minh",
    representativeName: "Nguyễn Văn An",
    businessLicenseUrl: "https://example.com/giay-phep-kd-saoviet.pdf",
    status: "PENDING_VERIFICATION",
    updatedAt: "2026-10-24T10:30:00Z",
  },
  {
    id: "org-02",
    organizationName: "Saigon Live Music Production",
    taxCode: "0398765432",
    phone: "0918765432",
    email: "contact@saigonlive.vn",
    address: "202 Hoàng Văn Thụ, Phường 9, Quận Phú Nhuận, TP. Hồ Chí Minh",
    representativeName: "Trần Minh Tuấn",
    businessLicenseUrl: "https://example.com/giay-phep-saigonlive.pdf",
    status: "PENDING_VERIFICATION",
    updatedAt: "2026-10-25T08:15:00Z",
  },
  {
    id: "org-03",
    organizationName: "Hanoi Symphony Orchestra Club",
    taxCode: "0102938475",
    phone: "0987654321",
    email: "info@hanoisymphony.vn",
    address: "Số 1 Tràng Tiền, Quận Hoàn Kiếm, Hà Nội",
    representativeName: "Lê Thu Hà",
    status: "VERIFIED",
    updatedAt: "2026-10-20T14:00:00Z",
  },
];
