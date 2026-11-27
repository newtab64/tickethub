// Du lieu mau cho seed. Khong import gi: test phia web doc truc tiep tep nay
// de kiem tra ma khu co that trong so do SVG.

export interface SeedTicketType {
  name: string;
  price: number;
  capacity: number;
  isSeated: boolean;
  mapZone: string | null;
}

export interface SeedEvent {
  slug: string;
  title: string;
  description: string;
  category: "Âm nhạc" | "Thể thao" | "Sân khấu & Nghệ thuật";
  bannerUrl: string;
  venueName: string;
  venueAddress: string;
  city: string;
  daysFromNow: number;
  mapKey: string | null;
  ticketTypes: SeedTicketType[];
}

/** Su kien mau tao boi seed.ts; o day chi bo sung anh xa so do va anh. */
export const SAMPLE_EVENT_MAP = {
  slug: "liveshow-am-nhac-mua-thu-2026",
  mapKey: "arena-t-stage",
  bannerUrl: "/images/events/vn/anh-trai.jpg",
  zones: {
    "Khu VIP A": "5715",
    "Khu Tiêu Chuẩn B": "27859",
    "Khu Đứng GA": "2196",
  },
};

const seated = (
  name: string,
  price: number,
  capacity: number,
  mapZone: string | null,
): SeedTicketType => ({ name, price, capacity, isSeated: true, mapZone });

const standing = (
  name: string,
  price: number,
  capacity: number,
  mapZone: string | null,
): SeedTicketType => ({ name, price, capacity, isSeated: false, mapZone });

export const SEED_EVENTS: SeedEvent[] = [
  {
    slug: "ha-anh-tuan-sketch-a-rose",
    title: "Hà Anh Tuấn Live Concert: Sketch a Rose",
    description:
      "Đêm nhạc ngoài trời của Hà Anh Tuấn cùng dàn nhạc và khách mời đặc biệt.",
    category: "Âm nhạc",
    bannerUrl: "/images/events/vn/ha-anh-tuan.jpg",
    venueName: "Sân vận động Quốc gia Mỹ Đình",
    venueAddress: "Đường Lê Đức Thọ, Nam Từ Liêm",
    city: "Hà Nội",
    daysFromNow: 21,
    mapKey: "stadium-concert",
    ticketTypes: [
      standing("Khu Đứng Sân Cỏ", 1800000, 200, "682"),
      seated("Khán Đài 101", 1500000, 60, "101"),
      seated("Khán Đài 406", 700000, 80, "406"),
    ],
  },
  {
    slug: "den-vau-show-cua-den",
    title: "Đen Vâu: Show của Đen",
    description:
      "Đêm diễn riêng của Đen Vâu với sân khấu chữ T và ban nhạc trực tiếp.",
    category: "Âm nhạc",
    bannerUrl: "/images/events/vn/den-vau.jpg",
    venueName: "Nhà thi đấu Phú Thọ",
    venueAddress: "Số 1 Lữ Gia, Quận 11",
    city: "TP. Hồ Chí Minh",
    daysFromNow: 28,
    mapKey: "arena-t-stage",
    ticketTypes: [
      seated("VIP", 2000000, 40, "5715"),
      standing("Khu Đứng Fanzone", 1100000, 150, "349"),
      seated("Hạng A", 800000, 100, "495"),
    ],
  },
  {
    slug: "chillies-qua-khung-cua-so",
    title: "Chillies: Qua Khung Cửa Sổ",
    description: "Đêm nhạc của ban nhạc Chillies tại Đà Nẵng.",
    category: "Âm nhạc",
    bannerUrl: "/images/events/vn/chillies.jpg",
    venueName: "Cung Thể thao Tiên Sơn",
    venueAddress: "Phan Đăng Lưu, Hải Châu",
    city: "Đà Nẵng",
    daysFromNow: 35,
    mapKey: null,
    ticketTypes: [
      standing("Vé đứng", 500000, 200, null),
      seated("Ghế khán đài", 750000, 60, null),
    ],
  },
  {
    slug: "vleague-cahn-nam-dinh",
    title: "V.League: Công An Hà Nội gặp Thép Xanh Nam Định",
    description: "Trận đấu thuộc giải bóng đá vô địch quốc gia.",
    category: "Thể thao",
    bannerUrl: "/images/events/vn/vleague-cahn.jpg",
    venueName: "Sân vận động Hàng Đẫy",
    venueAddress: "Số 9 Trịnh Hoài Đức, Đống Đa",
    city: "Hà Nội",
    daysFromNow: 24,
    mapKey: "stadium-football",
    ticketTypes: [
      seated("Khán Đài A VIP", 400000, 60, "138"),
      seated("Khán Đài B", 200000, 120, "112"),
      seated("Khán Đài C", 100000, 150, "408"),
    ],
  },
  {
    slug: "vba-finals-saigon-heat",
    title: "VBA Finals: Saigon Heat",
    description: "Trận chung kết giải bóng rổ chuyên nghiệp Việt Nam.",
    category: "Thể thao",
    bannerUrl: "/images/events/vn/saigon-heat.jpg",
    venueName: "Nhà thi đấu CIS",
    venueAddress: "Quận 7",
    city: "TP. Hồ Chí Minh",
    daysFromNow: 31,
    mapKey: "arena-basketball",
    ticketTypes: [
      seated("Ghế Sát Sân", 900000, 20, "19"),
      seated("Khán Đài VIP", 500000, 40, "C109"),
      seated("Khán Đài Thường", 200000, 100, "105"),
    ],
  },
  {
    slug: "a-o-show",
    title: "À Ố Show",
    description:
      "Chương trình xiếc tre kết hợp nhạc dân tộc tại Nhà hát Thành phố.",
    category: "Sân khấu & Nghệ thuật",
    bannerUrl: "/images/events/vn/a-o-show.jpg",
    venueName: "Nhà hát Thành phố Hồ Chí Minh",
    venueAddress: "Số 7 Công Trường Lam Sơn, Quận 1",
    city: "TP. Hồ Chí Minh",
    daysFromNow: 23,
    mapKey: "theater",
    ticketTypes: [
      seated("VIP Sân Khấu", 1600000, 30, "vip"),
      seated("Khán Phòng Chính", 1000000, 80, "orch"),
      seated("Ban Công Tầng 2", 700000, 50, "balc"),
    ],
  },
  {
    slug: "giao-huong-ghibli-ha-noi",
    title: "Hòa nhạc giao hưởng Ghibli",
    description: "Dàn nhạc giao hưởng trình diễn nhạc phim Studio Ghibli.",
    category: "Sân khấu & Nghệ thuật",
    bannerUrl: "/images/events/vn/dan-nhac-giao-huong.jpg",
    venueName: "Nhà hát Lớn Hà Nội",
    venueAddress: "Số 1 Tràng Tiền, Hoàn Kiếm",
    city: "Hà Nội",
    daysFromNow: 38,
    mapKey: "theater",
    ticketTypes: [
      seated("Khán Phòng Chính", 900000, 80, "orch"),
      seated("Loge Khách Quý", 1500000, 20, "box"),
      seated("Ban Công Tầng 2", 600000, 50, "balc"),
    ],
  },
  {
    slug: "kich-idecaf-ngay-xua-ngay-xua",
    title: "Kịch IDECAF: Ngày xửa ngày xưa",
    description: "Vở kịch thiếu nhi của sân khấu IDECAF.",
    category: "Sân khấu & Nghệ thuật",
    bannerUrl: "/images/events/vn/kich-idecaf.jpg",
    venueName: "Nhà hát Bến Thành",
    venueAddress: "Số 6 Mạc Đĩnh Chi, Quận 1",
    city: "TP. Hồ Chí Minh",
    daysFromNow: 42,
    mapKey: "theater",
    ticketTypes: [
      seated("VIP Sân Khấu", 500000, 30, "vip"),
      seated("Khán Phòng Chính", 300000, 100, "orch"),
    ],
  },
];
