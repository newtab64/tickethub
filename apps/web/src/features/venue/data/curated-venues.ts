import { type VenueMapKey } from "./venue-svg.generated";

export type VietnamCity = "TP. Hồ Chí Minh" | "Hà Nội" | "Đà Nẵng";

export type VenueCategory = "stadium" | "arena" | "theater" | "sports";

export interface CuratedZoneConfig {
  zoneId: string;
  name: string;
  price: number;
  capacity: number;
  isSeated: boolean;
}

export interface CuratedLayoutOption {
  id: string;
  name: string;
  categoryName: string;
  description: string;
  capacityEstimate: string;
  mapKey: VenueMapKey;
  defaultZones: CuratedZoneConfig[];
}

export interface CuratedVenue {
  id: string;
  name: string;
  shortName: string;
  city: VietnamCity;
  district: string;
  address: string;
  category: VenueCategory;
  categoryLabel: string;
  totalCapacity: string;
  thumbnailUrl: string;
  description: string;
  featuredEvents: string;
  layouts: CuratedLayoutOption[];
}

export const CURATED_LAYOUT_TEMPLATES: Record<string, CuratedLayoutOption> = {
  "arena-t-stage": {
    id: "layout-arena-t-stage",
    name: "Sân Khấu Chữ T (Live Concert)",
    categoryName: "Âm nhạc / Đại nhạc hội",
    description:
      "Sân khấu chữ T vươn dài ra giữa sàn đấu, khán đài vòm ôm trọn 3 phía với tầm nhìn cận cảnh.",
    capacityEstimate: "8.000 - 15.000 chỗ",
    mapKey: "arena-t-stage",
    defaultZones: [
      {
        zoneId: "495",
        name: "VIP Đặc Biệt (Sát Sân Khấu)",
        price: 2500000,
        capacity: 1200,
        isSeated: true,
      },
      {
        zoneId: "496",
        name: "VIP Vàng (Tầng 1 Chính Diện)",
        price: 1900000,
        capacity: 2500,
        isSeated: true,
      },
      {
        zoneId: "497",
        name: "VIP Bạc (Khán Đài Trung)",
        price: 1500000,
        capacity: 3500,
        isSeated: true,
      },
      {
        zoneId: "504",
        name: "Hạng A (Khán Đài Tầng Cao)",
        price: 900000,
        capacity: 4000,
        isSeated: true,
      },
      {
        zoneId: "682",
        name: "Khu Đứng Fanzone",
        price: 1200000,
        capacity: 2000,
        isSeated: false,
      },
    ],
  },
  "stadium-concert": {
    id: "layout-stadium-concert",
    name: "Mega Concert Sân Vận Động",
    categoryName: "Đại nhạc hội / Festival ngoài trời",
    description:
      "Sân khấu siêu lớn đặt tại đầu cầu môn, kết hợp khu đứng fanzone sân cỏ và các tầng khán đài phân khu riêng biệt.",
    capacityEstimate: "30.000 - 50.000 chỗ",
    mapKey: "stadium-concert",
    defaultZones: [
      {
        zoneId: "682",
        name: "Khu Đứng Sân Cỏ",
        price: 1920000,
        capacity: 8000,
        isSeated: false,
      },
      {
        zoneId: "101",
        name: "Khu 101 (Tầng 1 Cận Cảnh)",
        price: 1800000,
        capacity: 1500,
        isSeated: true,
      },
      {
        zoneId: "102",
        name: "Khu 102 (Tầng 1 Cận Cảnh)",
        price: 1740000,
        capacity: 1500,
        isSeated: true,
      },
      {
        zoneId: "105",
        name: "Khu 105 (Tầng 1 Góc Rộng)",
        price: 1860000,
        capacity: 1500,
        isSeated: true,
      },
      {
        zoneId: "110",
        name: "Khu 110 (Tầng 1 Chính Diện)",
        price: 1920000,
        capacity: 1800,
        isSeated: true,
      },
      {
        zoneId: "112",
        name: "Khu 112 (Tầng 1 Chính Diện)",
        price: 1800000,
        capacity: 1800,
        isSeated: true,
      },
      {
        zoneId: "135",
        name: "Khu 135 (Tầng 1 Đối Diện)",
        price: 1680000,
        capacity: 1400,
        isSeated: true,
      },
      {
        zoneId: "138",
        name: "Khu 138 (Tầng 1 Đối Diện)",
        price: 1740000,
        capacity: 1400,
        isSeated: true,
      },
      {
        zoneId: "146",
        name: "Khu 146 (Tầng 1 Cánh Gà)",
        price: 1600000,
        capacity: 1200,
        isSeated: true,
      },
      {
        zoneId: "406",
        name: "Khu 406 (Tầng 4 Tầm Nhìn Trung)",
        price: 1350000,
        capacity: 2500,
        isSeated: true,
      },
      {
        zoneId: "408",
        name: "Khu 408 (Tầng 4 Chính Diện)",
        price: 1450000,
        capacity: 2500,
        isSeated: true,
      },
      {
        zoneId: "410",
        name: "Khu 410 (Tầng 4 Chính Diện)",
        price: 1450000,
        capacity: 2500,
        isSeated: true,
      },
      {
        zoneId: "412",
        name: "Khu 412 (Tầng 4 Góc Nhìn Đẹp)",
        price: 1350000,
        capacity: 2500,
        isSeated: true,
      },
      {
        zoneId: "438",
        name: "Khu 438 (Tầng 4 Đối Diện)",
        price: 1250000,
        capacity: 2500,
        isSeated: true,
      },
      {
        zoneId: "608",
        name: "Khu 608 (Tầng 6 Toàn Cảnh)",
        price: 850000,
        capacity: 3500,
        isSeated: true,
      },
      {
        zoneId: "610",
        name: "Khu 610 (Tầng 6 Đỉnh Khán Đài)",
        price: 900000,
        capacity: 3500,
        isSeated: true,
      },
      {
        zoneId: "612",
        name: "Khu 612 (Tầng 6 Đỉnh Khán Đài)",
        price: 850000,
        capacity: 3500,
        isSeated: true,
      },
      {
        zoneId: "638",
        name: "Khu 638 (Tầng 6 Toàn Cảnh)",
        price: 750000,
        capacity: 3500,
        isSeated: true,
      },
    ],
  },
  "stadium-football": {
    id: "layout-stadium-football",
    name: "Sân Bóng Đá (Chuẩn Thi Đấu FIFA)",
    categoryName: "Bóng đá / Giải V-League & Quốc tế",
    description:
      "Mặt sân cỏ trung tâm bao quanh bởi 4 khán đài A, B, C, D phân chia khu vực độc lập.",
    capacityEstimate: "20.000 - 45.000 chỗ",
    mapKey: "stadium-football",
    defaultZones: [
      {
        zoneId: "138",
        name: "Khán đài A - Khu 138 (VIP Trung Tâm)",
        price: 330000,
        capacity: 2500,
        isSeated: true,
      },
      {
        zoneId: "140",
        name: "Khán đài A - Khu 140 (Cận Cảnh)",
        price: 300000,
        capacity: 3000,
        isSeated: true,
      },
      {
        zoneId: "112",
        name: "Khán đài B - Khu 112 (Chính Diện)",
        price: 210000,
        capacity: 6000,
        isSeated: true,
      },
      {
        zoneId: "114",
        name: "Khán đài B - Khu 114 (Chính Diện)",
        price: 200000,
        capacity: 6000,
        isSeated: true,
      },
      {
        zoneId: "408",
        name: "Khán đài C - Khu 408 (Sau Khung Thành)",
        price: 170000,
        capacity: 5000,
        isSeated: true,
      },
      {
        zoneId: "410",
        name: "Khán đài C - Khu 410 (Sau Khung Thành)",
        price: 160000,
        capacity: 5000,
        isSeated: true,
      },
      {
        zoneId: "610",
        name: "Khán đài D - Khu 610 (Tầng Trên)",
        price: 150000,
        capacity: 4000,
        isSeated: true,
      },
      {
        zoneId: "612",
        name: "Khán đài D - Khu 612 (Tầng Trên)",
        price: 140000,
        capacity: 4000,
        isSeated: true,
      },
    ],
  },
  "arena-basketball": {
    id: "layout-arena-basketball",
    name: "Sàn Đấu Bóng Rổ / Thể Thao Trong Nhà",
    categoryName: "Bóng rổ VBA / Thể thao trong nhà",
    description:
      "Sàn đấu gỗ tiêu chuẩn với hàng ghế Courtside sát sân và các khán đài vòng cung.",
    capacityEstimate: "3.500 - 8.000 chỗ",
    mapKey: "arena-basketball",
    defaultZones: [
      {
        zoneId: "19",
        name: "Ghế Sát Sân - Khu 19 (Courtside VIP)",
        price: 700000,
        capacity: 150,
        isSeated: true,
      },
      {
        zoneId: "22",
        name: "Ghế Sát Sân - Khu 22 (Courtside VIP)",
        price: 700000,
        capacity: 150,
        isSeated: true,
      },
      {
        zoneId: "C109",
        name: "Khán Đài VIP - C109 (Trung Tâm)",
        price: 500000,
        capacity: 600,
        isSeated: true,
      },
      {
        zoneId: "C110",
        name: "Khán Đài VIP - C110 (Trung Tâm)",
        price: 500000,
        capacity: 600,
        isSeated: true,
      },
      {
        zoneId: "105",
        name: "Khu 105 (Khán Đài Tầng Dưới)",
        price: 350000,
        capacity: 1200,
        isSeated: true,
      },
      {
        zoneId: "116",
        name: "Khu 116 (Khán Đài Tầng Dưới)",
        price: 350000,
        capacity: 1200,
        isSeated: true,
      },
      {
        zoneId: "120",
        name: "Khu 120 (Góc Sân Khách)",
        price: 300000,
        capacity: 1000,
        isSeated: true,
      },
      {
        zoneId: "223",
        name: "Khu 223 (Khán Đài Tầng Trên)",
        price: 200000,
        capacity: 1800,
        isSeated: true,
      },
    ],
  },
  theater: {
    id: "layout-theater",
    name: "Khán Phòng Nhà Hát & Thính Phòng",
    categoryName: "Kịch nghệ / Thính phòng / Stand-up Comedy",
    description:
      "Khán phòng nghệ thuật với hệ thống âm học chuyên biệt, phân tầng trệt, tầng lửng và ban công cao.",
    capacityEstimate: "1.200 - 3.000 chỗ",
    mapKey: "theater",
    defaultZones: [
      {
        zoneId: "518",
        name: "VIP Chính Diện (Tầng Trệt)",
        price: 1500000,
        capacity: 300,
        isSeated: true,
      },
      {
        zoneId: "519",
        name: "Khán Phòng Chính (Tầng Trệt)",
        price: 950000,
        capacity: 900,
        isSeated: true,
      },
      {
        zoneId: "520",
        name: "Tầng Lửng (Khán Phòng Giữa)",
        price: 650000,
        capacity: 600,
        isSeated: true,
      },
      {
        zoneId: "521",
        name: "Ban Công (Tầng Cao)",
        price: 400000,
        capacity: 500,
        isSeated: true,
      },
    ],
  },
};

export const CURATED_VENUES: CuratedVenue[] = [
  // ==================== TP. HỒ CHÍ MINH ====================
  {
    id: "vn-hcm-quan-khu-7",
    name: "Nhà Thi Đấu Quân Khu 7",
    shortName: "NTĐ Quân Khu 7",
    city: "TP. Hồ Chí Minh",
    district: "Quận Phú Nhuận",
    address: "202 Hoàng Văn Thụ, Phường 9, Quận Phú Nhuận, TP. Hồ Chí Minh",
    category: "arena",
    categoryLabel: "Nhà thi đấu đa năng",
    totalCapacity: "12.000 chỗ",
    thumbnailUrl: "/images/events/vn/anh-trai.jpg",
    description:
      "Địa điểm tổ chức đại nhạc hội và live concert trong nhà hàng đầu TP. Hồ Chí Minh, hệ thống điều hòa và âm thanh vòm.",
    featuredEvents:
      "Anh Trai Vượt Ngàn Chông Gai, Rap Việt All-Star Concert, VBA Finals",
    layouts: [
      CURATED_LAYOUT_TEMPLATES["arena-t-stage"],
      CURATED_LAYOUT_TEMPLATES["arena-basketball"],
    ],
  },
  {
    id: "vn-hcm-thong-nhat",
    name: "Sân Vận Động Thống Nhất",
    shortName: "SVĐ Thống Nhất",
    city: "TP. Hồ Chí Minh",
    district: "Quận 10",
    address: "138 Đào Duy Từ, Phường 6, Quận 10, TP. Hồ Chí Minh",
    category: "stadium",
    categoryLabel: "Sân vận động ngoài trời",
    totalCapacity: "25.000 chỗ",
    thumbnailUrl: "/images/events/vn/vleague-cahn.jpg",
    description:
      "Sân vận động thể thao trung tâm TP. Hồ Chí Minh, tổ chức các trận cầu V-League đỉnh cao và đại nhạc hội âm nhạc ngoài trời.",
    featuredEvents: "V-League TP.HCM, Đêm Nhạc Hội Tri Âm Mỹ Tâm",
    layouts: [
      CURATED_LAYOUT_TEMPLATES["stadium-football"],
      CURATED_LAYOUT_TEMPLATES["stadium-concert"],
    ],
  },
  {
    id: "vn-hcm-hoa-binh",
    name: "Nhà Hát Hòa Bình",
    shortName: "Nhà Hát Hòa Bình",
    city: "TP. Hồ Chí Minh",
    district: "Quận 10",
    address: "240 Đường 3 Tháng 2, Phường 12, Quận 10, TP. Hồ Chí Minh",
    category: "theater",
    categoryLabel: "Nhà hát nghệ thuật",
    totalCapacity: "2.500 chỗ",
    thumbnailUrl: "/images/events/vn/ha-anh-tuan.jpg",
    description:
      "Nhà hát biểu diễn nghệ thuật danh tiếng bậc nhất miền Nam, thiết kế thính phòng sang trọng và âm học hoàn hảo.",
    featuredEvents: "Hà Anh Tuấn Live Concert, Lễ Trao Giải Làn Sóng Xanh",
    layouts: [CURATED_LAYOUT_TEMPLATES["theater"]],
  },
  {
    id: "vn-hcm-ho-xuan-huong",
    name: "Nhà Thi Đấu Hồ Xuân Hương",
    shortName: "NTĐ Hồ Xuân Hương",
    city: "TP. Hồ Chí Minh",
    district: "Quận 3",
    address: "02 Hồ Xuân Hương, Phường 6, Quận 3, TP. Hồ Chí Minh",
    category: "sports",
    categoryLabel: "Sàn đấu thể thao",
    totalCapacity: "3.500 chỗ",
    thumbnailUrl: "/images/events/vn/saigon-heat.jpg",
    description:
      "Thánh địa của bóng rổ Sài Gòn, chuyên tổ chức giải bóng rổ chuyên nghiệp VBA và các sự kiện thể thao trong nhà.",
    featuredEvents:
      "VBA Saigon Heat Home Games, Giải Vô Địch Võ Thuật Lion Championship",
    layouts: [CURATED_LAYOUT_TEMPLATES["arena-basketball"]],
  },

  // ==================== HÀ NỘI ====================
  {
    id: "vn-hn-my-dinh",
    name: "Sân Vận Động Quốc Gia Mỹ Đình",
    shortName: "SVĐ Mỹ Đình",
    city: "Hà Nội",
    district: "Quận Nam Từ Liêm",
    address: "Đường Lê Đức Thọ, Phường Mỹ Đình 1, Quận Nam Từ Liêm, Hà Nội",
    category: "stadium",
    categoryLabel: "Sân vận động quốc gia",
    totalCapacity: "40.000 chỗ",
    thumbnailUrl: "/images/events/vn/vietnam-football.jpg",
    description:
      "Công trình thể thao và biểu diễn quy mô lớn nhất Việt Nam với 4 khán đài đồ sộ, từng đón tiếp các siêu sao quốc tế.",
    featuredEvents:
      "Đội tuyển Quốc gia Việt Nam, Born Pink World Tour, Concert BlackPink",
    layouts: [
      CURATED_LAYOUT_TEMPLATES["stadium-concert"],
      CURATED_LAYOUT_TEMPLATES["stadium-football"],
    ],
  },
  {
    id: "vn-hn-dien-kinh",
    name: "Cung Thể Thao Điền Kinh Trong Nhà Hà Nội",
    shortName: "Cung Điền Kinh Hà Nội",
    city: "Hà Nội",
    district: "Quận Nam Từ Liêm",
    address: "Đường Trần Hữu Dực, Phường Cầu Diễn, Quận Nam Từ Liêm, Hà Nội",
    category: "arena",
    categoryLabel: "Cung thể thao mái vòm",
    totalCapacity: "10.000 chỗ",
    thumbnailUrl: "/images/events/vn/den-vau.jpg",
    description:
      "Cung thể thao hiện đại bậc nhất Thủ đô với kiến trúc mái vòm, địa điểm tổ chức các concert âm nhạc hoành tráng.",
    featuredEvents:
      "Show Của Đen Vâu, Vũ - Bảo Tàng Của Nuối Tiếc Live Concert",
    layouts: [
      CURATED_LAYOUT_TEMPLATES["arena-t-stage"],
      CURATED_LAYOUT_TEMPLATES["arena-basketball"],
    ],
  },
  {
    id: "vn-hn-hang-day",
    name: "Sân Vận Động Hàng Đẫy",
    shortName: "SVĐ Hàng Đẫy",
    city: "Hà Nội",
    district: "Quận Đống Đa",
    address: "Số 9 Trịnh Hoài Đức, Phường Cát Linh, Quận Đống Đa, Hà Nội",
    category: "stadium",
    categoryLabel: "Sân bóng đá trung tâm",
    totalCapacity: "22.000 chỗ",
    thumbnailUrl: "/images/events/vn/thecong-hanoi.jpg",
    description:
      "Sân vận động lịch sử nằm ngay giữa lòng Hà Nội, cái nôi của bóng đá Thủ đô với bầu không khí cuồng nhiệt.",
    featuredEvents: "Trận Derby Hà Nội FC vs Thể Công Viettel, Công An Hà Nội",
    layouts: [CURATED_LAYOUT_TEMPLATES["stadium-football"]],
  },
  {
    id: "vn-hn-nha-hat-lon",
    name: "Nhà Hát Lớn Hà Nội",
    shortName: "Nhà Hát Lớn Hà Nội",
    city: "Hà Nội",
    district: "Quận Hoàn Kiếm",
    address: "Số 1 Tràng Tiền, Phường Tràng Tiền, Quận Hoàn Kiếm, Hà Nội",
    category: "theater",
    categoryLabel: "Nhà hát thính phòng Opera",
    totalCapacity: "1.200 chỗ",
    thumbnailUrl: "/images/events/vn/dan-nhac-giao-huong.jpg",
    description:
      "Biểu tượng kiến trúc và văn hóa Pháp cổ điển, khán phòng âm nhạc cổ điển và các vở nhạc kịch đỉnh cao.",
    featuredEvents:
      "Hòa Nhạc Giao Hưởng Quốc Gia, Đêm Nhạc Cổ Điển Toyota Concert",
    layouts: [CURATED_LAYOUT_TEMPLATES["theater"]],
  },

  // ==================== ĐÀ NẴNG ====================
  {
    id: "vn-danang-tien-son",
    name: "Cung Thể Thao Tiên Sơn (Đĩa Bay)",
    shortName: "Cung Tiên Sơn",
    city: "Đà Nẵng",
    district: "Quận Hải Châu",
    address:
      "Đường Phan Đăng Lưu, Phường Hòa Cường Bắc, Quận Hải Châu, Đà Nẵng",
    category: "arena",
    categoryLabel: "Cung thể thao đa năng",
    totalCapacity: "7.500 chỗ",
    thumbnailUrl: "",
    description:
      "Kiến trúc độc đáo hình đĩa bay nổi tiếng bên bờ sông Hàn, địa điểm tổ chức sự kiện biểu diễn và thể thao lớn nhất miền Trung.",
    featuredEvents:
      "Đại Nhạc Hội Festival Đà Nẵng, Giải Bóng Rổ Quốc Tế Danang Open",
    layouts: [
      CURATED_LAYOUT_TEMPLATES["arena-t-stage"],
      CURATED_LAYOUT_TEMPLATES["arena-basketball"],
    ],
  },
  {
    id: "vn-danang-hoa-xuan",
    name: "Sân Vận Động Hòa Xuân",
    shortName: "SVĐ Hòa Xuân",
    city: "Đà Nẵng",
    district: "Quận Cẩm Lệ",
    address: "Đường Đô Đốc Tuyết, Phường Hòa Xuân, Quận Cẩm Lệ, Đà Nẵng",
    category: "stadium",
    categoryLabel: "Sân vận động bóng đá hiện đại",
    totalCapacity: "20.000 chỗ",
    thumbnailUrl: "",
    description:
      "Sân vận động hiện đại không đường piste, khán đài dốc sát mặt cỏ đem lại góc nhìn cực nét cho cả thể thao và concert ngoài trời.",
    featuredEvents:
      "Giải Bóng Đá V-League SHB Đà Nẵng, Festival Âm Nhạc Bãi Biển Miền Trung",
    layouts: [
      CURATED_LAYOUT_TEMPLATES["stadium-football"],
      CURATED_LAYOUT_TEMPLATES["stadium-concert"],
    ],
  },
  {
    id: "vn-danang-trung-vuong",
    name: "Nhà Hát Trưng Vương Đà Nẵng",
    shortName: "Nhà Hát Trưng Vương",
    city: "Đà Nẵng",
    district: "Quận Hải Châu",
    address: "86 Hùng Vương, Phường Hải Châu 1, Quận Hải Châu, Đà Nẵng",
    category: "theater",
    categoryLabel: "Nhà hát nghệ thuật trung tâm",
    totalCapacity: "1.500 chỗ",
    thumbnailUrl: "",
    description:
      "Trung tâm văn hóa nghệ thuật tiêu biểu của thành phố Đà Nẵng, không gian thính phòng ấm cúng và chuyên nghiệp.",
    featuredEvents:
      "Đêm Nhạc Trịnh Công Sơn Đà Nẵng, Vở Kịch Broadway Chuyển Thể",
    layouts: [CURATED_LAYOUT_TEMPLATES["theater"]],
  },
];
