#!/usr/bin/env python3
"""
Builds apps/web/src/lib/venue-svg.generated.ts from the 5 venue SVG sources in venue-sources/:
  1. arena-t-stage.svg     (Indoor Arena T-Stage Live Concert)
  2. stadium-concert.svg   (Open-Air Mega Concert U-Bowl Amphitheater & Stadium)
  3. stadium.svg           (FIFA Standard Football Stadium Bowl)
  4. arena-basketball.svg  (Indoor Sports & Basketball Arena)
  5. theater.svg           (Grand Opera House & Symphony Concert Hall)

Each interactive section is rewritten as:
  <g data-zone="<zone id>" data-tier="<tier id>" data-sec="<section id>">
    <path class="sec" d="..."/>
    <text>...</text>
  </g>
so the React component can restyle zones purely with CSS (hover, active, selected).

Usage: python3 apps/web/scripts/build-venue-maps.py
"""
import json
import math
import re
from pathlib import Path
import xml.etree.ElementTree as ET

SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")

HERE = Path(__file__).resolve().parent
SRC = HERE / "venue-sources"
OUT = HERE.parent / "src" / "lib" / "venue-svg.generated.ts"


def q(tag):
    return "{%s}%s" % (SVG_NS, tag)


def sprite_xml(sid, d, text_items, fill, eid):
    t_xml = ""
    for lbl, tx, ty, fs, rot in text_items:
        tr = (
            f' transform="rotate({rot:.1f} {tx:.1f} {ty:.1f})"'
            if rot and abs(rot) > 1.0
            else ""
        )
        t_xml += (
            f'<text x="{tx:.2f}" y="{ty:.2f}"{tr} font-size="{fs:.1f}" '
            f'text-anchor="middle" eid="{eid}" t="tc">{lbl}</text>'
        )
    return (
        f'<g sprite-identifier="{sid}">'
        f'<path d="{d}" fill="{fill}" stroke="#000000" stroke-width="3px" '
        f'fill-opacity="0.3" eid="{eid}" t="tc" style="display: none"></path>'
        f"{t_xml}"
        f'<path d="{d}" fill="{fill}" stroke="#000000" stroke-width="3px" '
        f'fill-opacity="0.3" obs="true"></path>'
        f"</g>"
    )


def u_bowl_point(cx, cy_curve, half_w, straight_top, r_offset, t):
    l_straight = cy_curve - straight_top
    radius = half_w + r_offset
    l_arc = math.pi * radius
    total = 2 * l_straight + l_arc
    s = t * total
    if s <= l_straight:
        return (cx - radius, straight_top + s, -90.0)
    if s <= l_straight + l_arc:
        u = (s - l_straight) / l_arc
        deg = 180.0 - u * 180.0
        rad = math.radians(deg)
        x = cx + radius * math.cos(rad)
        y = cy_curve + radius * math.sin(rad)
        rot = deg - 90.0
        if rot > 90:
            rot -= 180
        elif rot < -90:
            rot += 180
        return (x, y, rot)
    s2 = s - (l_straight + l_arc)
    return (cx + radius, cy_curve - s2, 90.0)


def u_bowl_wedge(cx, cy_curve, half_w, straight_top, r_in, r_out, t1, t2, steps=12):
    pts_in = [
        u_bowl_point(cx, cy_curve, half_w, straight_top, r_in, t1 + (t2 - t1) * i / steps)
        for i in range(steps + 1)
    ]
    pts_out = [
        u_bowl_point(cx, cy_curve, half_w, straight_top, r_out, t2 - (t2 - t1) * i / steps)
        for i in range(steps + 1)
    ]
    d = f"M{pts_in[0][0]:.1f},{pts_in[0][1]:.1f}"
    for x, y, _ in pts_in[1:]:
        d += f"L{x:.1f},{y:.1f}"
    for x, y, _ in pts_out:
        d += f"L{x:.1f},{y:.1f}"
    d += "Z"
    mid = u_bowl_point(
        cx, cy_curve, half_w, straight_top, (r_in + r_out) / 2.0, (t1 + t2) / 2.0
    )
    return d, mid[0], mid[1], mid[2]


def polar(cx, cy, r_x, r_y, deg):
    rad = math.radians(deg)
    return (cx + r_x * math.cos(rad), cy + r_y * math.sin(rad))


def radial_wedge(cx, cy, rx_in, ry_in, rx_out, ry_out, deg1, deg2, steps=12):
    pts_in = [
        polar(cx, cy, rx_in, ry_in, deg1 + (deg2 - deg1) * i / steps)
        for i in range(steps + 1)
    ]
    pts_out = [
        polar(cx, cy, rx_out, ry_out, deg2 - (deg2 - deg1) * i / steps)
        for i in range(steps + 1)
    ]
    d = f"M{pts_in[0][0]:.1f},{pts_in[0][1]:.1f}"
    for x, y in pts_in[1:]:
        d += f"L{x:.1f},{y:.1f}"
    for x, y in pts_out:
        d += f"L{x:.1f},{y:.1f}"
    d += "Z"
    deg_mid = (deg1 + deg2) / 2.0
    mx, my = polar(cx, cy, (rx_in + rx_out) / 2.0, (ry_in + ry_out) / 2.0, deg_mid)
    rot = deg_mid - 90.0
    if rot > 90:
        rot -= 180
    elif rot < -90:
        rot += 180
    return d, mx, my, rot


def ensure_stadium_concert_svg():
    cx, cy_curve, half_w, straight_top = 2048.0, 2240.0, 720.0, 860.0
    sprites = []
    sid_counter = 3100000

    # Priority Standing Pit (eid 11448) inside the dual catwalk arms
    d_prio = (
        "M1790,820 L1995,820 L1995,1190 L1910,1265 L1995,1340 "
        "L2101,1340 L2186,1265 L2101,1190 L2101,820 L2306,820 "
        "L2420,960 L2420,1410 L1676,1410 L1676,960 Z"
    )
    sprites.append(
        sprite_xml(
            f"s{sid_counter}",
            d_prio,
            [("PRIORITY", 1830, 1080, 42, 0)],
            "#a8f0c6",
            "11448",
        )
    )
    sid_counter += 1

    # Main Standing Fanzone / Standing Pen (eid 682) wrapping catwalk & B-stage
    d_pen = (
        "M1390,880 L1650,880 L1650,1435 L2446,1435 L2446,880 "
        "L2706,880 L2706,1840 L1390,1840 Z"
    )
    sprites.append(
        sprite_xml(
            f"s{sid_counter}",
            d_pen,
            [("STANDING PEN", 2048, 1650, 72, 0)],
            "#92f4cf",
            "682",
        )
    )
    sid_counter += 1

    # Rear Floor Seated Blocks A1..A4, B1..B4 around FOH
    floor_blocks = [
        ("A1", 1390, 1880, 290, 240),
        ("A2", 1700, 1880, 160, 240),
        ("A3", 2236, 1880, 160, 240),
        ("A4", 2416, 1880, 290, 240),
        ("B1", 1430, 2150, 280, 250),
        ("B2", 1730, 2150, 298, 250),
        ("B3", 2068, 2150, 298, 250),
        ("B4", 2386, 2150, 280, 250),
    ]
    for lbl, fx, fy, fw, fh in floor_blocks:
        d_fl = f"M{fx},{fy}h{fw}v{fh}h{-fw}Z"
        sprites.append(
            sprite_xml(
                f"s{sid_counter}",
                d_fl,
                [(lbl, fx + fw / 2, fy + fh / 2 + 18, 50, 0)],
                "#d8b4fe",
                lbl,
            )
        )
        sid_counter += 1

    # 100-Level Lower U-Bowl (28 sections)
    sec_100 = [
        "148", "101", "102", "103", "104", "105", "106", "107", "108", "109",
        "110", "111", "112", "113", "114", "115", "116", "117", "118",
        "135", "136", "137", "138", "139", "140", "142", "146", "147",
    ]
    n100 = len(sec_100)
    gap = 0.0022
    for i, sec_id in enumerate(sec_100):
        t1 = i / n100 + gap
        t2 = (i + 1) / n100 - gap
        d, mx, my, rot = u_bowl_wedge(cx, cy_curve, half_w, straight_top, 40, 340, t1, t2)
        eid = "885" if sec_id in ("147", "148") else sec_id
        sprites.append(
            sprite_xml(f"s{sid_counter}", d, [(sec_id, mx, my, 56, rot)], "#b5d5fc", eid)
        )
        sid_counter += 1

    # VIP Skybox Suites Ring between 100 and 400 level (16 suites)
    for i in range(16):
        t1 = 0.06 + i * (0.88 / 16) + 0.002
        t2 = 0.06 + (i + 1) * (0.88 / 16) - 0.002
        lbl = f"S{i + 1}"
        d, mx, my, rot = u_bowl_wedge(
            cx, cy_curve, half_w, straight_top, 355, 455, t1, t2, steps=6
        )
        sprites.append(
            sprite_xml(f"s{sid_counter}", d, [(lbl, mx, my, 32, rot)], "#fde68a", lbl)
        )
        sid_counter += 1

    # 400-Level Middle U-Bowl (24 sections)
    sec_400 = [
        "442", "401", "402", "403", "404", "405", "406", "407", "408", "409",
        "410", "411", "412", "413", "414", "415", "416",
        "434", "435", "436", "437", "438", "439", "443",
    ]
    n400 = len(sec_400)
    for i, sec_id in enumerate(sec_400):
        t1 = i / n400 + gap
        t2 = (i + 1) / n400 - gap
        d, mx, my, rot = u_bowl_wedge(cx, cy_curve, half_w, straight_top, 470, 740, t1, t2)
        eid = "885" if sec_id in ("442", "443") else sec_id
        sprites.append(
            sprite_xml(f"s{sid_counter}", d, [(sec_id, mx, my, 54, rot)], "#fbcfe8", eid)
        )
        sid_counter += 1

    # 600-Level Upper Panoramic U-Bowl (24 sections)
    sec_600 = [
        "601", "602", "603", "604", "605", "606", "607", "608", "609", "610",
        "611", "612", "613", "614", "615", "616", "617",
        "634", "635", "636", "637", "638", "639", "640",
    ]
    n600 = len(sec_600)
    for i, sec_id in enumerate(sec_600):
        t1 = i / n600 + gap
        t2 = (i + 1) / n600 - gap
        d, mx, my, rot = u_bowl_wedge(cx, cy_curve, half_w, straight_top, 760, 1040, t1, t2)
        sprites.append(
            sprite_xml(
                f"s{sid_counter}", d, [(sec_id, mx, my, 54, rot)], "#c7d2fe", sec_id
            )
        )
        sid_counter += 1

    stage_d = (
        "M1280,320 L2816,320 L2816,660 L2340,660 L2340,780 L2115,780 "
        "L2115,1160 L2220,1265 L2048,1415 L1876,1265 L1981,1160 "
        "L1981,780 L1756,780 L1756,660 L1280,660 Z"
    )
    stage_group = (
        '<g id="config_stage 1" stroke="none" stroke-width="1">'
        f'<path d="{stage_d}" fill="#999999"/>'
        '<text x="2048" y="535" fill="#000000" font-family="ArialMT, Arial" '
        'font-weight="400" font-size="135" text-anchor="middle">STAGE</text>'
        "</g>"
    )

    xboxes = ""
    for bx, by in [(1490, 1480), (2496, 1480), (1490, 2450), (2496, 2450)]:
        xboxes += (
            '<g fill="none" stroke="#000000" stroke-width="4">'
            f'<path d="M{bx},{by}h110v95h-110z"/>'
            f'<path d="M{bx + 110},{by}l-110,95"/>'
            f'<path d="M{bx},{by}l110,95"/>'
            "</g>"
        )

    outer_wall_pts = [
        u_bowl_point(cx, cy_curve, half_w, straight_top, 1085, i / 48)
        for i in range(49)
    ]
    wall_d = f"M{outer_wall_pts[0][0]:.1f},{outer_wall_pts[0][1]:.1f}" + "".join(
        f"L{p[0]:.1f},{p[1]:.1f}" for p in outer_wall_pts[1:]
    )

    sprites_group = (
        '<g id="config_sprites 1">'
        '<path d="M1885,1880h326v230h-326z" fill="#cccccc" stroke="none" stroke-width="1"/>'
        '<text x="2048" y="2020" fill="#000000" stroke="none" stroke-width="1" '
        'font-family="ArialMT, Arial" font-weight="400" font-size="76" text-anchor="middle">FOH</text>'
        f"{xboxes}"
        "</g>"
    )

    svg = (
        '<svg style="enable-background:new 0 0 4096 4096;" version="1.1" '
        'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        'viewBox="180.00000, 240.00000, 3736.00000, 3820.00000">'
        "<g>"
        + "".join(sprites)
        + "</g>"
        + stage_group
        + sprites_group
        + "</svg>"
    )
    (SRC / "stadium-concert.svg").write_text(svg, encoding="utf-8")


def ensure_theater_svg():
    cx, cy = 2048.0, 620.0
    sprites = []
    sid_counter = 3200000

    # 1. Front VIP Stalls (radial fan around Orchestra Pit, 7 wedges)
    # Center 5 wedges -> eid "vip", Outer 2 wing wedges -> eid "518"
    vip_labels = ["518A", "VIP 1", "VIP 2", "VIP 3", "VIP 4", "VIP 5", "518B"]
    a_start, a_end = 132.0, 48.0
    n_vip = len(vip_labels)
    for i, lbl in enumerate(vip_labels):
        d1 = a_start + (a_end - a_start) * (i / n_vip) - 0.5
        d2 = a_start + (a_end - a_start) * ((i + 1) / n_vip) + 0.5
        d, mx, my, rot = radial_wedge(cx, cy, 520, 420, 860, 700, d1, d2, steps=10)
        eid = "518" if lbl.startswith("518") else "vip"
        sprites.append(
            sprite_xml(f"s{sid_counter}", d, [(lbl, mx, my, 44, rot)], "#fde68a", eid)
        )
        sid_counter += 1

    # 2. Main Orchestra Stalls / Parterre - Front Band (7 radial wedges: 101..107 -> eid "orch")
    orch_front = ["101", "102", "103", "104", "105", "106", "107"]
    a_start, a_end = 136.0, 44.0
    for i, lbl in enumerate(orch_front):
        d1 = a_start + (a_end - a_start) * (i / len(orch_front)) - 0.5
        d2 = a_start + (a_end - a_start) * ((i + 1) / len(orch_front)) + 0.5
        d, mx, my, rot = radial_wedge(cx, cy, 885, 725, 1270, 1040, d1, d2, steps=10)
        sprites.append(
            sprite_xml(f"s{sid_counter}", d, [(lbl, mx, my, 50, rot)], "#b5d5fc", "orch")
        )
        sid_counter += 1

    # 3. Main Orchestra Stalls / Parterre - Rear Band (7 radial wedges: 111..117 -> eid "orch" & "519")
    orch_rear = ["111", "112", "113", "114", "115", "116", "117"]
    for i, lbl in enumerate(orch_rear):
        d1 = a_start + (a_end - a_start) * (i / len(orch_rear)) - 0.5
        d2 = a_start + (a_end - a_start) * ((i + 1) / len(orch_rear)) + 0.5
        d, mx, my, rot = radial_wedge(cx, cy, 1295, 1065, 1660, 1365, d1, d2, steps=10)
        eid = "519" if lbl in ("111", "117") else "orch"
        sprites.append(
            sprite_xml(f"s{sid_counter}", d, [(lbl, mx, my, 50, rot)], "#93c5fd", eid)
        )
        sid_counter += 1

    # 4. Stepped Side Opera Loge Boxes (L1..L8 on West wall, R1..R8 on East wall -> eid "box")
    for i in range(8):
        # Left boxes along angled West wall
        bx = 470 - i * 18
        by = 820 + i * 185
        bw, bh = 195, 160
        d_l = f"M{bx},{by} L{bx + bw},{by + 22} L{bx + bw},{by + bh + 22} L{bx},{by + bh} Z"
        eid_box = "885" if i >= 6 else "box"
        sprites.append(
            sprite_xml(
                f"s{sid_counter}",
                d_l,
                [(f"L{i + 1}", bx + bw / 2, by + bh / 2 + 20, 42, 0)],
                "#bbf7d0",
                eid_box,
            )
        )
        sid_counter += 1

        # Right boxes along angled East wall
        rx = 3626 + i * 18 - bw
        d_r = f"M{rx},{by + 22} L{rx + bw},{by} L{rx + bw},{by + bh} L{rx},{by + bh + 22} Z"
        sprites.append(
            sprite_xml(
                f"s{sid_counter}",
                d_r,
                [(f"R{i + 1}", rx + bw / 2, by + bh / 2 + 20, 42, 0)],
                "#bbf7d0",
                eid_box,
            )
        )
        sid_counter += 1

    # 5. Royal Center Box & Dress Circle / Mezzanine (11 curved wedges: 201..211)
    # Center wedge 206 is ROYAL BOX (eid "box"), inner wedges -> eid "orch", wing wedges -> eid "520"
    dc_secs = ["201", "202", "203", "204", "205", "ROYAL", "207", "208", "209", "210", "211"]
    a_start, a_end = 144.0, 36.0
    for i, lbl in enumerate(dc_secs):
        d1 = a_start + (a_end - a_start) * (i / len(dc_secs)) - 0.45
        d2 = a_start + (a_end - a_start) * ((i + 1) / len(dc_secs)) + 0.45
        d, mx, my, rot = radial_wedge(cx, cy, 1820, 1520, 2240, 1870, d1, d2, steps=10)
        if lbl == "ROYAL":
            eid = "box"
        elif lbl in ("201", "202", "210", "211"):
            eid = "520"
        else:
            eid = "orch"
        sprites.append(
            sprite_xml(f"s{sid_counter}", d, [(lbl, mx, my, 46, rot)], "#f9a8d4", eid)
        )
        sid_counter += 1

    # 6. Grand Tier Balcony - Lower Ring (13 sweeping wedges: 301..313 -> eid "balc")
    balc_lower = [f"30{i}" if i < 10 else f"3{i}" for i in range(1, 14)]
    a_start, a_end = 148.0, 32.0
    for i, lbl in enumerate(balc_lower):
        d1 = a_start + (a_end - a_start) * (i / len(balc_lower)) - 0.4
        d2 = a_start + (a_end - a_start) * ((i + 1) / len(balc_lower)) + 0.4
        d, mx, my, rot = radial_wedge(cx, cy, 2290, 1915, 2720, 2275, d1, d2, steps=10)
        sprites.append(
            sprite_xml(f"s{sid_counter}", d, [(lbl, mx, my, 48, rot)], "#c4b5fd", "balc")
        )
        sid_counter += 1

    # 7. Upper Amphitheater Gallery - Outer Ring (13 sweeping wedges: 401..413 -> eid "balc", "521", "885")
    balc_upper = [f"40{i}" if i < 10 else f"4{i}" for i in range(1, 14)]
    for i, lbl in enumerate(balc_upper):
        d1 = a_start + (a_end - a_start) * (i / len(balc_upper)) - 0.4
        d2 = a_start + (a_end - a_start) * ((i + 1) / len(balc_upper)) + 0.4
        d, mx, my, rot = radial_wedge(cx, cy, 2750, 2305, 3160, 2650, d1, d2, steps=10)
        if i in (0, 12):
            eid = "885"
        elif i in (1, 2, 10, 11):
            eid = "521"
        else:
            eid = "balc"
        sprites.append(
            sprite_xml(f"s{sid_counter}", d, [(lbl, mx, my, 46, rot)], "#ddd6fe", eid)
        )
        sid_counter += 1

    # Curved Proscenium Stage with Apron & Acoustic Wings
    stage_d = (
        "M980,220 L3116,220 L3116,580 L2820,580 "
        "Q2048,840 1276,580 L980,580 Z"
    )
    stage_group = (
        '<g id="config_stage 1" stroke="none" stroke-width="1">'
        f'<path d="{stage_d}" fill="#999999"/>'
        '<text x="2048" y="485" fill="#000000" font-family="ArialMT, Arial" '
        'font-weight="400" font-size="130" text-anchor="middle">STAGE</text>'
        "</g>"
    )

    # Orchestra Pit + FOH Control Booth + Acoustic Reflector Towers + Outer Opera Wall
    pit_d = "M1340,635 Q2048,885 2756,635 L2680,785 Q2048,1010 1416,785 Z"
    xboxes = ""
    for bx, by in [(740, 620), (3226, 620), (740, 2320), (3226, 2320)]:
        xboxes += (
            '<g fill="none" stroke="#000000" stroke-width="4">'
            f'<path d="M{bx},{by}h120v95h-120z"/>'
            f'<path d="M{bx + 120},{by}l-120,95"/>'
            f'<path d="M{bx},{by}l120,95"/>'
            "</g>"
        )

    outer_arc = [
        polar(cx, cy, 3260, 2740, 152.0 + (28.0 - 152.0) * i / 36)
        for i in range(37)
    ]
    wall_d = (
        "M680,380 L3416,380 L3680,2020 "
        + "".join(f"L{x:.1f},{y:.1f}" for x, y in reversed(outer_arc))
        + " L416,2020 Z"
    )

    sprites_group = (
        '<g id="config_sprites 1">'
        f'<path d="{pit_d}" fill="#cccccc" stroke="none" stroke-width="1"/>'
        '<text x="2048" y="835" fill="#000000" stroke="none" stroke-width="1" '
        'font-family="ArialMT, Arial" font-weight="400" font-size="52" text-anchor="middle">ORCHESTRA PIT</text>'
        '<path d="M1878,2005h340v125h-340z" fill="#cccccc" stroke="none" stroke-width="1"/>'
        '<text x="2048" y="2088" fill="#000000" stroke="none" stroke-width="1" '
        'font-family="ArialMT, Arial" font-weight="400" font-size="64" text-anchor="middle">FOH</text>'
        f"{xboxes}"
        "</g>"
    )

    svg = (
        '<svg style="enable-background:new 0 0 4096 4096;" version="1.1" '
        'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        'viewBox="240.00000, 180.00000, 3616.00000, 3280.00000">'
        "<g>"
        + "".join(sprites)
        + "</g>"
        + stage_group
        + sprites_group
        + "</svg>"
    )
    (SRC / "theater.svg").write_text(svg, encoding="utf-8")


RULES = {
    "arena-t-stage": [
        (r"^CATEGORY ([A-F])RESTRICTED$", r"HẠNG \1 HẠN CHẾ"),
        (r"^RESTRICTED$", "HẠN CHẾ"),
        (r"^CATEGORY ([A-F])$", r"HẠNG \1"),
        (r"^STANDING$", "KHU ĐỨNG"),
        (r"^ULTIMATE VIP$", "VIP ĐẶC BIỆT"),
        (r"^GOLD VIP$", "VIP VÀNG"),
        (r"^SILVER VIP$", "VIP BẠC"),
        (r"^STAGE$", "SÂN KHẤU"),
    ],
    "stadium-concert": [
        (r"^STANDING PEN$", "KHU ĐỨNG"),
        (r"^PRIORITY$", "ĐỨNG ƯU TIÊN"),
        (r"^STAGE$", "SÂN KHẤU"),
    ],
    "stadium": [
        (r"^STANDING PEN$", "KHU ĐỨNG"),
        (r"^PRIORITY$", "ĐỨNG"),
        (r"^STANDING$", "ƯU TIÊN"),
        (r"^STAGE$", "SÂN KHẤU"),
        (r"^WEST ZONE$", "KHU TÂY"),
        (r"^Exposed to weather elements$", "Không có mái che"),
        (r"^N$", "B"),
        (r"^S$", "N"),
        (r"^W$", "T"),
    ],
    "arena-basketball": [
        (r"^HOME$", "CHỦ NHÀ"),
        (r"^VISITOR$", "KHÁCH"),
        (r"^SCORERS$", "THƯ KÝ"),
    ],
    "theater": [
        (r"^STAGE$", "SÂN KHẤU"),
        (r"^ORCHESTRA PIT$", "HỐ NHẠC"),
        (r"^ROYAL$", "LOGE VIP"),
    ],
}


def translate(el, rules):
    for node in el.iter():
        if node.tag not in (q("text"), q("tspan")):
            continue
        if node.text and node.text.strip():
            t = node.text.strip()
            for pat, rep in rules:
                if re.match(pat, t):
                    t = re.sub(pat, rep, t)
                    break
            node.text = t


def process(src_name, rules_key, variant):
    tree = ET.parse(SRC / src_name)
    root = tree.getroot()
    rules = RULES[rules_key]
    parent_of = {c: p for p in root.iter() for c in p}
    pen_d = None

    for g in [g for g in root.iter(q("g")) if "sprite-identifier" in g.attrib]:
        eid = next((c.get("eid") for c in g if c.get("eid")), "")
        parent = parent_of[g]
        if variant == "football" and eid in ("682", "11448"):
            if eid == "682":
                for c in g:
                    if c.tag == q("path") and c.get("eid"):
                        pen_d = c.get("d")
                        break
            parent.remove(g)
            continue

        sec_text = ""
        for tnode in g.iter():
            if tnode.tag in (q("text"), q("tspan")) and tnode.text and tnode.text.strip():
                sec_text = tnode.text.strip().replace(" ", "")
                break

        if rules_key in ("stadium", "stadium-concert"):
            if sec_text in ("ĐỨNG", "KHUĐỨNG", "STANDING", "STANDINGPEN"):
                zone_key = "682"
            elif sec_text in ("ĐỨNGƯUTIÊN", "PRIORITY", "PRIORITYSTANDING"):
                zone_key = "11448"
            elif eid == "885":
                zone_key = "885"
            elif sec_text:
                zone_key = sec_text
            else:
                zone_key = eid
        elif rules_key == "arena-basketball":
            if sec_text:
                zone_key = sec_text
            else:
                zone_key = eid
        else:
            zone_key = eid

        ng = ET.Element(
            q("g"),
            {
                "data-zone": zone_key,
                "data-tier": eid,
                "data-sec": g.get("sprite-identifier"),
            },
        )
        for c in g:
            if c.tag == q("path"):
                if c.get("obs"):
                    continue
                if c.get("eid"):
                    ET.SubElement(ng, q("path"), {"class": "sec", "d": c.get("d")})
                else:
                    ng.append(c)
            elif c.tag == q("text"):
                c.attrib.pop("eid", None)
                c.attrib.pop("t", None)
                translate(c, rules)
                ng.append(c)
            else:
                ng.append(c)
        idx = list(parent).index(g)
        parent.remove(g)
        parent.insert(idx, ng)

    outer = next(c for c in root if c.tag == q("g"))

    if rules_key in ("arena-t-stage", "stadium", "stadium-concert", "theater"):
        parent_of = {c: p for p in root.iter() for c in p}

        def inside_zone(el):
            while True:
                if el.get("data-zone") is not None:
                    return True
                if el not in parent_of:
                    return False
                el = parent_of[el]

        decor = [e for e in root.iter() if e is not root and not inside_zone(e)]
        gray_paths = [
            e for e in decor if e.tag == q("path") and e.get("fill") == "#999999"
        ]
        stage_path = max(gray_paths, key=lambda e: len(e.get("d", "")), default=None)
        for e in decor:
            if e not in parent_of:
                continue
            text = (
                "".join(e.itertext()).strip()
                if e.tag in (q("text"), q("g"))
                else ""
            )
            if variant == "football":
                is_x_box = (
                    e.tag == q("g")
                    and e.get("fill") == "none"
                    and e.get("stroke-width") == "4"
                )
                is_foh_box = e.tag == q("path") and e.get("fill") == "#cccccc"
                if (
                    (e.tag == q("text") and text in ("STAGE", "FOH"))
                    or is_x_box
                    or is_foh_box
                    or e is stage_path
                ):
                    parent_of[e].remove(e)
                    continue
            if e is stage_path:
                e.set("class", "stage")
            elif e.tag == q("path") and e.get("fill") in ("#999999", "#cccccc"):
                e.set("class", "prop")
            elif (
                e.tag == q("g")
                and e.get("fill") == "none"
                and e.get("stroke-width") == "4"
            ):
                e.set("class", "prop-box")
            elif e.tag == q("text") and text == "STAGE":
                e.set("class", "stage-label")
                e.set(
                    "font-size",
                    "150"
                    if rules_key == "arena-t-stage"
                    else ("120" if rules_key in ("stadium-concert", "theater") else "105"),
                )
            if e.tag == q("text"):
                translate(e, rules)

    if variant == "football":
        pitch = ET.Element(q("g"), {"class": "pitch-group"})
        ET.SubElement(pitch, q("path"), {"class": "pitch-apron", "d": pen_d})
        ET.SubElement(
            pitch,
            q("rect"),
            {"class": "pitch", "x": "1500", "y": "1450", "width": "1600", "height": "1190"},
        )
        marks = [
            ("line", {"x1": "2300", "y1": "1450", "x2": "2300", "y2": "2640"}),
            ("circle", {"cx": "2300", "cy": "2045", "r": "160"}),
            ("rect", {"x": "1500", "y": "1805", "width": "330", "height": "480"}),
            ("rect", {"x": "2770", "y": "1805", "width": "330", "height": "480"}),
        ]
        for tag, attrs in marks:
            attrs["class"] = "pitch-mark"
            ET.SubElement(pitch, q(tag), attrs)
        outer.insert(0, pitch)

    vb = re.sub(r"\s*,\s*|\s+", " ", root.get("viewBox").strip())
    markup = "".join(ET.tostring(c, encoding="unicode") for c in root)
    markup = re.sub(r'\sxmlns(:\w+)?="[^"]*"', "", markup)
    markup = re.sub(r">\s+<", "><", markup)
    return {"viewBox": vb, "markup": markup}


def main():
    ensure_stadium_concert_svg()
    ensure_theater_svg()
    maps = {
        "arena-t-stage": process("arena-t-stage.svg", "arena-t-stage", "concert"),
        "stadium-concert": process("stadium-concert.svg", "stadium-concert", "concert"),
        "stadium-football": process("stadium.svg", "stadium", "football"),
        "arena-basketball": process("arena-basketball.svg", "arena-basketball", "sport"),
        "theater": process("theater.svg", "theater", "theater"),
    }
    lines = [
        "// Generated by apps/web/scripts/build-venue-maps.py. Do not edit by hand.",
        "",
        "export type VenueMapKey =",
        "  | " + "\n  | ".join(json.dumps(k) for k in maps) + ";",
        "",
        "export const VENUE_SVG: Record<VenueMapKey, { viewBox: string; markup: string }> = {",
    ]
    for k, v in maps.items():
        lines.append(f"  {json.dumps(k)}: {{")
        lines.append(f"    viewBox: {json.dumps(v['viewBox'])},")
        lines.append(f"    markup: {json.dumps(v['markup'], ensure_ascii=False)},")
        lines.append("  },")
    lines.append("};")
    lines.append("")
    OUT.write_text("\n".join(lines), encoding="utf-8")
    for k, v in maps.items():
        print(k, v["viewBox"], len(v["markup"]))


if __name__ == "__main__":
    main()
