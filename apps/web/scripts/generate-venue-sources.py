#!/usr/bin/env python3
"""
Sinh 6 so do SVG moi cho Tuan 2 (UC04) vao apps/web/scripts/venue-sources/.

Moi khu ngoi la mot nhom:
  <g data-zone="<id>" data-tier="<tang>" data-sec="<id>"><path class="sec" d="..."/><text>...</text></g>
dung chung hop dong voi build-venue-maps.py va seat-map.tsx (tu to mau bang CSS theo data-zone).
Hinh trang tri chi dung cac class da co trong seat-map.tsx: stage, stage-label, prop, pitch-apron,
pitch, pitch-mark. Khong dung mau thang trong SVG.

Cach dung (chay xong thi chay tiep build-venue-maps.py):
  python apps/web/scripts/generate-venue-sources.py
  python apps/web/scripts/build-venue-maps.py
"""
import math
from pathlib import Path

OUT = Path(__file__).resolve().parent / "venue-sources"


def n(v):
    s = f"{v:.1f}".rstrip("0").rstrip(".")
    return "0" if s in ("", "-0") else s


def pt(cx, cy, rx, ry, deg):
    a = math.radians(deg)
    return cx + rx * math.cos(a), cy + ry * math.sin(a)


def sector_path(cx, cy, rx1, ry1, rx2, ry2, a1, a2):
    """Cung vanh khuyen elip: ban kinh trong (rx1, ry1), ngoai (rx2, ry2); goc tang theo chieu kim dong ho."""
    p1 = pt(cx, cy, rx1, ry1, a1)
    p2 = pt(cx, cy, rx2, ry2, a1)
    p3 = pt(cx, cy, rx2, ry2, a2)
    p4 = pt(cx, cy, rx1, ry1, a2)
    large = 1 if (a2 - a1) > 180 else 0
    return (
        f"M{n(p1[0])} {n(p1[1])} L{n(p2[0])} {n(p2[1])} "
        f"A{n(rx2)} {n(ry2)} 0 {large} 1 {n(p3[0])} {n(p3[1])} "
        f"L{n(p4[0])} {n(p4[1])} "
        f"A{n(rx1)} {n(ry1)} 0 {large} 0 {n(p1[0])} {n(p1[1])} Z"
    )


def rect_path(x, y, w, h):
    return f"M{n(x)} {n(y)} H{n(x + w)} V{n(y + h)} H{n(x)} Z"


def zone(zid, tier, d, label, lx, ly, size):
    return (
        f'<g data-zone="{zid}" data-tier="{tier}" data-sec="{zid}">'
        f'<path class="sec" d="{d}"/>'
        f'<text x="{n(lx)}" y="{n(ly)}" font-size="{size}" text-anchor="middle" '
        f'dominant-baseline="central">{label}</text></g>'
    )


def stage(d):
    return f'<path class="stage" d="{d}"/>'


def stage_label(text, x, y, size):
    return (
        f'<text class="stage-label" x="{n(x)}" y="{n(y)}" font-size="{size}" '
        f'text-anchor="middle" dominant-baseline="central">{text}</text>'
    )


def ring(zones, tier, cx, cy, rx1, ry1, rx2, ry2, a_start, a_end, count, size,
         ids, gap=0.6, skip=None, label=None):
    """Them mot vong cac khu hinh quat. ids la iterator tao ma khu."""
    step = (a_end - a_start) / count
    for i in range(count):
        a1 = a_start + i * step + gap / 2
        a2 = a_start + (i + 1) * step - gap / 2
        mid = (a1 + a2) / 2
        if skip and skip(mid % 360):
            continue
        zid = next(ids)
        d = sector_path(cx, cy, rx1, ry1, rx2, ry2, a1, a2)
        lx, ly = pt(cx, cy, (rx1 + rx2) / 2, (ry1 + ry2) / 2, mid)
        zones.append(zone(zid, tier, d, label(zid) if label else zid, lx, ly, size))


def row_blocks(zones, tier, x, y, w, h, count, gap, size, ids, label=None):
    """Chia mot hinh chu nhat thanh `count` khu nam ngang."""
    bw = (w - gap * (count - 1)) / count
    for i in range(count):
        zid = next(ids)
        bx = x + i * (bw + gap)
        zones.append(zone(zid, tier, rect_path(bx, y, bw, h), label(zid) if label else zid,
                          bx + bw / 2, y + h / 2, size))


def col_blocks(zones, tier, x, y, w, h, count, gap, size, ids, label=None):
    """Chia mot hinh chu nhat thanh `count` khu xep doc."""
    bh = (h - gap * (count - 1)) / count
    for i in range(count):
        zid = next(ids)
        by = y + i * (bh + gap)
        zones.append(zone(zid, tier, rect_path(x, by, w, bh), label(zid) if label else zid,
                          x + w / 2, by + bh / 2, size))


def seq(prefix, start=1):
    return iter(f"{prefix}{i}" for i in range(start, 10_000))


# ---------------------------------------------------------------- 1. mega-festival
def mega_festival():
    cx, cy = 3000, 2700
    parts = [f'<ellipse class="prop" cx="{cx}" cy="{cy}" rx="3000" ry="2700"/>']
    parts.append(stage("M2100 1280 H3900 V1750 H3350 V2000 H2650 V1750 H2100 Z"))
    parts.append(stage_label("SÂN KHẤU CHÍNH", 3000, 1500, 120))
    parts.append(f'<circle class="stage" cx="3000" cy="3050" r="95"/>')
    zones = []
    row_blocks(zones, "pit", 2200, 2030, 1600, 300, 3, 20, 80, seq("PIT-", 1),
               label=lambda z: z.replace("PIT-", "P"))
    # Khu dung san co: 4 cot x 3 hang
    ids = iter(f"F{i:02d}" for i in range(1, 13))
    for r in range(3):
        row_blocks(zones, "floor", 1800, 2400 + r * (413 + 30), 2400, 413, 4, 30, 90, ids)
    omit = lambda m: 235 <= m <= 305
    ring(zones, "lower", cx, cy, 1800, 1500, 2150, 1850, 0, 360, 36, 85, iter(str(i) for i in range(101, 400)), skip=omit)
    ring(zones, "mid", cx, cy, 2200, 1900, 2550, 2250, 0, 360, 44, 80, iter(str(i) for i in range(201, 500)), skip=omit)
    ring(zones, "upper", cx, cy, 2600, 2300, 2950, 2650, 0, 360, 52, 75, iter(str(i) for i in range(301, 600)), skip=omit)
    return "0 0 6000 5400", parts + zones


# ---------------------------------------------------------------- 2. concert-open-air
def concert_open_air():
    parts = [
        stage("M1300 120 H2700 V520 H2160 V1100 H1840 V520 H1300 Z"),
        stage_label("SÂN KHẤU", 2000, 320, 110),
    ]
    zones = []
    row_blocks(zones, "vvip", 1300, 1180, 1400, 220, 2, 80, 90, seq("VV"))
    row_blocks(zones, "vip", 900, 1440, 2200, 320, 4, 20, 85, seq("V"))
    row_blocks(zones, "cat1", 500, 1800, 3000, 320, 6, 20, 80, seq("A"))
    row_blocks(zones, "cat2", 500, 2160, 3000, 320, 6, 20, 80, seq("B"))
    row_blocks(zones, "cat3", 300, 2520, 3400, 330, 8, 20, 75, seq("C"))
    col_blocks(zones, "wing", 130, 600, 310, 1850, 4, 20, 75, seq("W", 1))
    col_blocks(zones, "wing", 3560, 600, 310, 1850, 4, 20, 75, seq("W", 5))
    return "0 0 4000 3000", parts + zones


# ---------------------------------------------------------------- 3. theater-hoa-binh
def theater_hoa_binh():
    cx, cy = 1950, 250
    parts = [
        stage("M1250 40 H2650 V280 Q1950 350 1250 280 Z"),
        stage_label("SÂN KHẤU", 1950, 150, 70),
    ]
    zones = []
    ring(zones, "orch-front", cx, cy, 650, 650, 1000, 1000, 55, 125, 5, 70, seq("A"), gap=1)
    ring(zones, "orch-mid", cx, cy, 1040, 1040, 1390, 1390, 50, 130, 5, 70, seq("B"), gap=1)
    ring(zones, "orch-rear", cx, cy, 1430, 1430, 1780, 1780, 45, 135, 6, 70, seq("C"), gap=1)
    ring(zones, "mezzanine", cx, cy, 1840, 1840, 2140, 2140, 42, 138, 7, 70, seq("M"), gap=1)
    ring(zones, "balcony", cx, cy, 2200, 2200, 2500, 2500, 40, 140, 9, 70, seq("BC"), gap=1)
    col_blocks(zones, "box", 300, 420, 220, 1160, 4, 20, 60, seq("L"))
    col_blocks(zones, "box", 3380, 420, 220, 1160, 4, 20, 60, seq("R"))
    return "0 0 3900 3000", parts + zones


# ---------------------------------------------------------------- 4. football-hang-day
def football_hang_day():
    parts = [
        '<g class="pitch-group">'
        '<rect class="pitch-apron" x="1050" y="850" width="1900" height="1300" rx="40"/>'
        '<rect class="pitch" x="1150" y="950" width="1700" height="1100"/>'
        '<line class="pitch-mark" x1="2000" y1="950" x2="2000" y2="2050"/>'
        '<circle class="pitch-mark" cx="2000" cy="1500" r="130"/>'
        '<rect class="pitch-mark" x="1150" y="1173" width="267" height="654"/>'
        '<rect class="pitch-mark" x="2583" y="1173" width="267" height="654"/>'
        '<rect class="pitch-mark" x="1150" y="1352" width="89" height="296"/>'
        '<rect class="pitch-mark" x="2761" y="1352" width="89" height="296"/>'
        '</g>'
    ]
    zones = []
    row_blocks(zones, "vip", 1050, 600, 1900, 220, 6, 20, 70, seq("A"))
    row_blocks(zones, "upper", 800, 320, 2400, 240, 10, 20, 70, seq("A", 7))
    row_blocks(zones, "lower", 1050, 2180, 1900, 220, 8, 20, 70, seq("B"))
    row_blocks(zones, "upper", 800, 2460, 2400, 240, 10, 20, 70, seq("B", 9))
    col_blocks(zones, "lower", 780, 900, 220, 1200, 6, 20, 70, seq("C"))
    col_blocks(zones, "upper", 520, 900, 220, 1200, 6, 20, 70, seq("C", 7))
    col_blocks(zones, "lower", 3000, 900, 220, 1200, 6, 20, 70, seq("D"))
    col_blocks(zones, "upper", 3260, 900, 220, 1200, 6, 20, 70, seq("D", 7))
    return "0 0 4000 3000", parts + zones


# ---------------------------------------------------------------- 5. basketball-saigon-heat
def basketball_saigon_heat():
    cx, cy = 2000, 1500
    parts = [
        stage(rect_path(1300, 1120, 1400, 760)),
        '<line class="pitch-mark" x1="2000" y1="1120" x2="2000" y2="1880"/>',
        '<circle class="pitch-mark" cx="2000" cy="1500" r="110"/>',
        '<rect class="pitch-mark" x="1300" y="1377" width="290" height="246"/>',
        '<rect class="pitch-mark" x="2410" y="1377" width="290" height="246"/>',
    ]
    zones = []
    ring(zones, "courtside", cx, cy, 1000, 640, 1120, 760, 0, 360, 12, 50, seq("CS"), gap=1.2)
    ring(zones, "lower", cx, cy, 1180, 790, 1560, 1070, 0, 360, 24, 70, iter(str(i) for i in range(101, 200)), gap=0.8)
    ring(zones, "upper", cx, cy, 1620, 1130, 1960, 1390, 0, 360, 32, 65, iter(str(i) for i in range(201, 300)), gap=0.7)
    return "0 0 4000 3000", parts + zones


# ---------------------------------------------------------------- 6. opera-nha-hat-lon
def opera_nha_hat_lon():
    cx, cy = 1900, 300
    parts = [
        stage("M1300 40 H2500 V260 Q1900 330 1300 260 Z"),
        stage_label("SÂN KHẤU", 1900, 150, 64),
    ]
    zones = []
    ring(zones, "stalls-front", cx, cy, 500, 500, 850, 850, 30, 150, 5, 60, seq("S"), gap=1)
    ring(zones, "stalls-rear", cx, cy, 890, 890, 1230, 1230, 25, 155, 6, 60, seq("S", 6), gap=1)
    ring(zones, "loge-1", cx, cy, 1280, 1152, 1440, 1296, 32, 148, 10, 54, seq("LA"), gap=0.8)
    ring(zones, "loge-2", cx, cy, 1480, 1332, 1640, 1476, 32, 148, 12, 54, seq("LB"), gap=0.8)
    ring(zones, "loge-3", cx, cy, 1680, 1512, 1840, 1656, 32, 148, 14, 54, seq("LC"), gap=0.8)
    ring(zones, "gallery", cx, cy, 1880, 1692, 2150, 1935, 32, 148, 10, 60, seq("G"), gap=0.8)
    return "0 0 3800 2900", parts + zones


MAPS = {
    "mega-festival": mega_festival,
    "concert-open-air": concert_open_air,
    "theater-hoa-binh": theater_hoa_binh,
    "football-hang-day": football_hang_day,
    "basketball-saigon-heat": basketball_saigon_heat,
    "opera-nha-hat-lon": opera_nha_hat_lon,
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for key, fn in MAPS.items():
        view_box, parts = fn()
        body = "\n  ".join(parts)
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}">\n  {body}\n</svg>\n'
        )
        (OUT / f"{key}.svg").write_text(svg, encoding="utf-8")
        zone_count = sum(1 for p in parts if p.startswith("<g data-zone="))
        print(f"{key}.svg  viewBox={view_box}  zones={zone_count}  bytes={len(svg)}")


if __name__ == "__main__":
    main()
