/**
 * Cau hinh khu/hang ve cho 6 so do moi (W03-FE2, yeu cau them tuan 2).
 *
 * File nay thuan (pure): chi dung `import type` de test Node chay duoc truc tiep.
 * So do (markup SVG) duoc truyen vao tu ben ngoai, nen khong import venue-svg.generated.
 * Phan noi vao catalog nam o events-catalog.ts.
 */
import type { TicketListing } from "./events-catalog";

export const NEW_VENUE_MAP_KEYS = [
  "mega-festival",
  "concert-open-air",
  "theater-hoa-binh",
  "football-hang-day",
  "basketball-saigon-heat",
  "opera-nha-hat-lon",
] as const;

export type NewVenueMapKey = (typeof NEW_VENUE_MAP_KEYS)[number];

/** 1 so do lon (kiem thu minimap) + 5 so do rieng cho 5 su kien. */
export const EVENT_MAP_OVERRIDES: Record<string, NewVenueMapKey> = {
  "evt-nhung-thanh-pho-mo-mang": "mega-festival",
  "evt-anh-trai-vuot-ngan-chong-gai": "concert-open-air",
  "evt-ha-anh-tuan-sketch-a-rose": "theater-hoa-binh",
  "evt-vleague-cahn-namdinh": "football-hang-day",
  "evt-vba-finals-saigon-heat": "basketball-saigon-heat",
  "evt-giao-huong-ghibli-hanoi": "opera-nha-hat-lon",
};

export function resolveNewMapKey(eventId: string): NewVenueMapKey | null {
  return Object.prototype.hasOwnProperty.call(EVENT_MAP_OVERRIDES, eventId)
    ? EVENT_MAP_OVERRIDES[eventId]
    : null;
}

export interface TierConfig {
  /** Ten hien thi cua hang/tang */
  name: string;
  /** He so nhan voi gia thap nhat cua su kien */
  priceMult: number;
  /** Anh minh hoa goc nhin tu khu (AI tao, dat trong public/) */
  viewImage: string;
  /** Vé đứng (không số ghế) */
  standing?: boolean;
  /** Dac diem hien thi tren the ve */
  features: string[];
}

const img = (map: string, level: "near" | "mid" | "high") =>
  `/images/venues/${map}/${level}.jpg`;

export const NEW_MAP_TIERS: Record<NewVenueMapKey, Record<string, TierConfig>> = {
  "mega-festival": {
    pit: {
      name: "Khu Pit sát sân khấu",
      priceMult: 2.2,
      viewImage: img("mega-festival", "near"),
      standing: true,
      features: ["Đứng sát sân khấu chính", "Trải nghiệm trực diện nghệ sĩ"],
    },
    floor: {
      name: "Khu Đứng Floor",
      priceMult: 1.7,
      viewImage: img("mega-festival", "near"),
      standing: true,
      features: ["Khu đứng tự do", "Gần sân khấu"],
    },
    lower: {
      name: "Khán đài tầng 1",
      priceMult: 1.4,
      viewImage: img("mega-festival", "mid"),
      features: ["Ghế ngồi tầng thấp", "Tầm nhìn bao quát sân khấu"],
    },
    mid: {
      name: "Khán đài tầng 2",
      priceMult: 1.1,
      viewImage: img("mega-festival", "mid"),
      features: ["Ghế ngồi tầng giữa", "Nhìn rõ toàn bộ sân khấu"],
    },
    upper: {
      name: "Khán đài tầng 3",
      priceMult: 1.0,
      viewImage: img("mega-festival", "high"),
      features: ["Ghế ngồi tầng cao", "Giá tiết kiệm"],
    },
  },
  "concert-open-air": {
    vvip: {
      name: "VVIP",
      priceMult: 3.0,
      viewImage: img("concert-open-air", "near"),
      features: ["Vị trí trung tâm sát sân khấu", "Lối vào ưu tiên", "Quà tặng VVIP"],
    },
    vip: {
      name: "VIP",
      priceMult: 2.2,
      viewImage: img("concert-open-air", "near"),
      features: ["Gần sân khấu", "Lối vào ưu tiên"],
    },
    cat1: {
      name: "Hạng 1",
      priceMult: 1.6,
      viewImage: img("concert-open-air", "mid"),
      features: ["Tầm nhìn chính diện sân khấu"],
    },
    cat2: {
      name: "Hạng 2",
      priceMult: 1.3,
      viewImage: img("concert-open-air", "mid"),
      features: ["Tầm nhìn tốt, khoảng cách vừa phải"],
    },
    cat3: {
      name: "Hạng 3",
      priceMult: 1.0,
      viewImage: img("concert-open-air", "high"),
      features: ["Giá tiết kiệm", "Khu vực rộng rãi"],
    },
    wing: {
      name: "Khu cánh",
      priceMult: 1.0,
      viewImage: img("concert-open-air", "high"),
      features: ["Nhìn lệch về một bên sân khấu", "Giá tiết kiệm"],
    },
  },
  "theater-hoa-binh": {
    "orch-front": {
      name: "Platea hàng đầu",
      priceMult: 2.2,
      viewImage: img("theater-hoa-binh", "near"),
      features: ["Hàng ghế sát sân khấu", "Nhìn rõ biểu cảm nghệ sĩ"],
    },
    "orch-mid": {
      name: "Platea giữa",
      priceMult: 1.8,
      viewImage: img("theater-hoa-binh", "near"),
      features: ["Âm thanh cân bằng", "Tầm nhìn chính diện"],
    },
    "orch-rear": {
      name: "Platea cuối",
      priceMult: 1.4,
      viewImage: img("theater-hoa-binh", "mid"),
      features: ["Tầm nhìn bao quát sân khấu"],
    },
    mezzanine: {
      name: "Tầng lửng",
      priceMult: 1.2,
      viewImage: img("theater-hoa-binh", "mid"),
      features: ["Nhìn từ trên cao xuống sân khấu"],
    },
    balcony: {
      name: "Ban công",
      priceMult: 1.0,
      viewImage: img("theater-hoa-binh", "high"),
      features: ["Giá tiết kiệm", "Nhìn toàn cảnh nhà hát"],
    },
    box: {
      name: "Lô riêng",
      priceMult: 2.6,
      viewImage: img("theater-hoa-binh", "mid"),
      features: ["Không gian riêng tư", "Nhìn xéo về sân khấu"],
    },
  },
  "football-hang-day": {
    vip: {
      name: "Khán đài A VIP",
      priceMult: 3.0,
      viewImage: img("football-hang-day", "near"),
      features: ["Khán đài chính có mái che", "Ghế VIP", "Lối vào riêng"],
    },
    lower: {
      name: "Khán đài tầng dưới",
      priceMult: 1.8,
      viewImage: img("football-hang-day", "mid"),
      features: ["Gần đường biên", "Không khí cổ vũ sôi động"],
    },
    upper: {
      name: "Khán đài tầng trên",
      priceMult: 1.0,
      viewImage: img("football-hang-day", "high"),
      features: ["Nhìn toàn bộ sân", "Giá tiết kiệm"],
    },
  },
  "basketball-saigon-heat": {
    courtside: {
      name: "Courtside",
      priceMult: 4.0,
      viewImage: img("basketball-saigon-heat", "near"),
      features: ["Ngồi sát sân thi đấu", "Lối vào riêng"],
    },
    lower: {
      name: "Khán đài tầng dưới",
      priceMult: 1.8,
      viewImage: img("basketball-saigon-heat", "mid"),
      features: ["Nhìn rõ toàn sân", "Gần băng ghế đội"],
    },
    upper: {
      name: "Khán đài tầng trên",
      priceMult: 1.0,
      viewImage: img("basketball-saigon-heat", "high"),
      features: ["Giá tiết kiệm", "Nhìn toàn cảnh nhà thi đấu"],
    },
  },
  "opera-nha-hat-lon": {
    "stalls-front": {
      name: "Platea hàng đầu",
      priceMult: 2.4,
      viewImage: img("opera-nha-hat-lon", "near"),
      features: ["Sát dàn nhạc", "Âm thanh tốt nhất"],
    },
    "stalls-rear": {
      name: "Platea phía sau",
      priceMult: 1.8,
      viewImage: img("opera-nha-hat-lon", "near"),
      features: ["Âm thanh cân bằng", "Tầm nhìn chính diện"],
    },
    "loge-1": {
      name: "Ban công tầng 1",
      priceMult: 1.5,
      viewImage: img("opera-nha-hat-lon", "mid"),
      features: ["Nhìn từ trên cao xuống sân khấu"],
    },
    "loge-2": {
      name: "Ban công tầng 2",
      priceMult: 1.3,
      viewImage: img("opera-nha-hat-lon", "mid"),
      features: ["Tầm nhìn bao quát", "Không gian cổ điển"],
    },
    "loge-3": {
      name: "Ban công tầng 3",
      priceMult: 1.1,
      viewImage: img("opera-nha-hat-lon", "high"),
      features: ["Nhìn toàn cảnh sảnh khán giả"],
    },
    gallery: {
      name: "Tầng thượng",
      priceMult: 1.0,
      viewImage: img("opera-nha-hat-lon", "high"),
      features: ["Giá tiết kiệm", "Trải nghiệm âm thanh vòm"],
    },
  },
};

export interface ExtractedZone {
  zoneId: string;
  tier: string;
  label: string;
}

/** Doc danh sach khu tu markup SVG (moi khu la <g data-zone data-tier>...<text>NHAN</text>). */
export function extractZones(markup: string): ExtractedZone[] {
  const zones: ExtractedZone[] = [];
  const re =
    /<g data-zone="([^"]+)" data-tier="([^"]+)"[^>]*>([\s\S]*?)<\/g>/g;
  for (const m of markup.matchAll(re)) {
    const label = m[3].match(/<text\b[^>]*>([^<]*)<\/text>/)?.[1] ?? m[1];
    zones.push({ zoneId: m[1], tier: m[2], label: label.trim() });
  }
  return zones;
}

/** FNV-1a 32 bit: du de rai deu va on dinh giua cac lan chay. */
function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const MIN_LISTINGS = 3;
const ON_SALE_PERCENT = 55;

/**
 * Sinh danh sach ve cho mot su kien tren map moi: moi khu "dang ban" co dung 1 listing.
 * Ket qua phu thuoc vao (event.id, zone) nen on dinh; gia = gia goc su kien * he so hang.
 */
export function buildZoneListings(
  event: { id: string; minPriceNumber: number },
  mapKey: NewVenueMapKey | string,
  markup: string,
): TicketListing[] {
  const tiers = NEW_MAP_TIERS[mapKey as NewVenueMapKey];
  if (!tiers) return [];
  const roundVnd = (n: number) => Math.round(n / 10000) * 10000;

  const entries = extractZones(markup)
    .filter((z) => tiers[z.tier])
    .map((z) => ({ z, h: hash32(`${event.id}:${z.zoneId}`) }));

  // Khu nao ban: theo hash; neu qua it thi bo sung theo hash nho nhat de luon co du lieu.
  const onSale = new Set(
    entries.filter((e) => e.h % 100 < ON_SALE_PERCENT).map((e) => e.z.zoneId),
  );
  if (onSale.size < MIN_LISTINGS) {
    for (const e of [...entries].sort((a, b) => a.h - b.h)) {
      if (onSale.size >= MIN_LISTINGS) break;
      onSale.add(e.z.zoneId);
    }
  }

  return entries
    .filter((e) => onSale.has(e.z.zoneId))
    .map(({ z, h }) => {
      const tier = tiers[z.tier];
      const jitter = 0.94 + ((h >>> 8) % 13) / 100;
      const price = Math.max(
        10000,
        roundVnd(event.minPriceNumber * tier.priceMult * jitter),
      );
      const availableTickets = 2 + ((h >>> 16) % 38);
      const dealScore = 7 + ((h >>> 4) % 4);
      const seat = 1 + ((h >>> 12) % 24) * 2;
      const rowLetter = String.fromCharCode(65 + ((h >>> 20) % 8));
      const listing: TicketListing = {
        id: `${event.id}-${z.zoneId}`,
        eventId: event.id,
        zoneId: z.zoneId,
        zoneName: `${tier.name} - ${z.label}`,
        section: `${tier.name} - ${z.label}`,
        seatInfo: tier.standing
          ? "Vé đứng tự do"
          : `Ghế ${String(seat).padStart(2, "0")} - ${String(seat + 1).padStart(2, "0")}`,
        price,
        availableTickets,
        dealScore,
        dealLabel:
          dealScore >= 9 ? "Tuyệt vời" : dealScore === 8 ? "Rất tốt" : "Tốt",
        features: tier.standing
          ? [...tier.features]
          : ["2 vé ngồi cạnh nhau", ...tier.features],
        viewFromSeatUrl: tier.viewImage,
      };
      if (!tier.standing) listing.row = `Hàng ${rowLetter}`;
      if (tier.standing) listing.isStanding = true;
      if (h % 4 === 0) listing.originalPrice = roundVnd(price * 1.1);
      if (availableTickets <= 4) listing.isLastTickets = true;
      return listing;
    });
}
