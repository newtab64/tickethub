#!/usr/bin/env python3
"""
Builds apps/web/src/lib/venue-svg.generated.ts from the raw venue SVG sources.

Each interactive section is rewritten as:
  <g data-zone="<ticket class id>" data-sec="<section id>"><path class="sec" d="..."/><text>...</text></g>
so the React component can restyle zones purely with CSS (hover, active, selected).
Labels are translated to Vietnamese. A football variant and a theater layout are derived/added here.

Usage: python3 apps/web/scripts/build-venue-maps.py
"""
import json
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

        # Divide individual sections rather than grouping an entire stadium into a single class
        if rules_key == "stadium":
            if sec_text in ("ĐỨNG", "KHUĐỨNG", "STANDING", "STANDINGPEN"):
                zone_key = "682"
            elif sec_text in ("ĐỨNGƯUTIÊN", "PRIORITY", "PRIORITYSTANDING"):
                zone_key = "11448"
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

        ng = ET.Element(q("g"), {
            "data-zone": zone_key,
            "data-tier": eid,
            "data-sec": g.get("sprite-identifier"),
        })
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

    if rules_key in ("arena-t-stage", "stadium"):
        parent_of = {c: p for p in root.iter() for c in p}

        def inside_zone(el):
            while True:
                if el.get("data-zone") is not None:
                    return True
                if el not in parent_of:
                    return False
                el = parent_of[el]

        decor = [e for e in root.iter() if e is not root and not inside_zone(e)]
        gray_paths = [e for e in decor if e.tag == q("path") and e.get("fill") == "#999999"]
        stage_path = max(gray_paths, key=lambda e: len(e.get("d", "")), default=None)
        for e in decor:
            if e not in parent_of:
                continue
            text = "".join(e.itertext()).strip() if e.tag in (q("text"), q("g")) else ""
            if variant == "football":
                is_x_box = e.tag == q("g") and e.get("fill") == "none" and e.get("stroke-width") == "4"
                is_foh_box = e.tag == q("path") and e.get("fill") == "#cccccc"
                if (e.tag == q("text") and text in ("STAGE", "FOH")) or is_x_box or is_foh_box or e is stage_path:
                    parent_of[e].remove(e)
                    continue
            if e is stage_path:
                e.set("class", "stage")
            elif e.tag == q("path") and e.get("fill") == "#999999":
                e.set("class", "prop")
            elif e.tag == q("g") and e.get("fill") == "none" and e.get("stroke-width") == "4":
                e.set("class", "prop-box")
            elif e.tag == q("text") and text == "STAGE":
                e.set("class", "stage-label")
                e.set("font-size", "150" if rules_key == "arena-t-stage" else "105")
            if e.tag == q("text"):
                translate(e, rules)

    if variant == "football":
        pitch = ET.Element(q("g"), {"class": "pitch-group"})
        ET.SubElement(pitch, q("path"), {"class": "pitch-apron", "d": pen_d})
        ET.SubElement(pitch, q("rect"), {"class": "pitch", "x": "1500", "y": "1450", "width": "1600", "height": "1190"})
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


def theater():
    def sec(zone, sec_id, d, label, lx, ly, size, rotate=None):
        tr = f' transform="rotate({rotate} {lx} {ly})"' if rotate else ""
        return (
            f'<g data-zone="{zone}" data-sec="{sec_id}"><path class="sec" d="{d}"/>'
            f'<text x="{lx}" y="{ly}" font-size="{size}" text-anchor="middle"{tr}>{label}</text></g>'
        )

    parts = [
        '<path class="stage" d="M420 40 H1180 V200 Q800 250 420 200 Z"/>',
        '<text class="stage-label" x="800" y="140" font-size="64" text-anchor="middle">SÂN KHẤU</text>',
        sec("vip", "vip-c", "M570 300 L1030 300 L1045 470 L555 470 Z", "VIP", 800, 400, 58),
        sec("vip", "vip-l", "M380 300 L550 300 L535 470 L340 470 Z", "VIP", 445, 400, 50),
        sec("vip", "vip-r", "M1050 300 L1220 300 L1260 470 L1065 470 Z", "VIP", 1155, 400, 50),
        sec("orch", "orch-c", "M555 490 L1045 490 L1060 770 L540 770 Z", "HẠNG NHÌ", 800, 645, 58),
        sec("orch", "orch-l", "M340 490 L535 490 L520 770 L290 770 Z", "HẠNG NHÌ", 410, 645, 40),
        sec("orch", "orch-r", "M1065 490 L1260 490 L1310 770 L1080 770 Z", "HẠNG NHÌ", 1190, 645, 40),
    ]
    for i in range(4):
        y = 300 + i * 130
        parts.append(sec("box", f"box-l{i}", f"M150 {y} H260 V{y + 115} H150 Z", f"L{i + 1}", 205, y + 70, 36))
        parts.append(sec("box", f"box-r{i}", f"M1340 {y} H1450 V{y + 115} H1340 Z", f"L{i + 5}", 1395, y + 70, 36))
    parts += [
        sec("balc", "balc-c", "M520 800 Q800 770 1080 800 L1100 1010 Q800 975 500 1010 Z", "BAN CÔNG", 800, 925, 54),
        sec("balc", "balc-l", "M240 810 L510 800 L490 1010 L190 975 Z", "BAN CÔNG", 350, 915, 38),
        sec("balc", "balc-r", "M1360 810 L1090 800 L1110 1010 L1410 975 Z", "BAN CÔNG", 1250, 915, 38),
    ]
    return {"viewBox": "0 0 1600 1100", "markup": "".join(parts)}


def prepared(filename):
    """Loads an SVG already in final form (written by generate-venue-sources.py)."""
    text = (SRC / filename).read_text(encoding="utf-8")
    m = re.search(r'<svg\b[^>]*\sviewBox="([^"]+)"[^>]*>(.*)</svg>\s*$', text, re.S)
    if not m:
        raise SystemExit(f"{filename}: cannot find <svg viewBox>")
    vb = re.sub(r"\s*,\s*|\s+", " ", m.group(1).strip())
    markup = re.sub(r'\sxmlns(:\w+)?="[^"]*"', "", m.group(2))
    markup = re.sub(r">\s+<", "><", markup).strip()
    return {"viewBox": vb, "markup": markup}


def main():
    maps = {
        "arena-t-stage": process("arena-t-stage.svg", "arena-t-stage", "concert"),
        "stadium-concert": process("stadium.svg", "stadium", "concert"),
        "stadium-football": process("stadium.svg", "stadium", "football"),
        "arena-basketball": process("arena-basketball.svg", "arena-basketball", "sport"),
        "theater": theater(),
        "mega-festival": prepared("mega-festival.svg"),
        "concert-open-air": prepared("concert-open-air.svg"),
        "theater-hoa-binh": prepared("theater-hoa-binh.svg"),
        "football-hang-day": prepared("football-hang-day.svg"),
        "basketball-saigon-heat": prepared("basketball-saigon-heat.svg"),
        "opera-nha-hat-lon": prepared("opera-nha-hat-lon.svg"),
    }
    lines = [
        "// Generated by apps/web/scripts/build-venue-maps.py. Do not edit by hand.",
        "",
        'export type VenueMapKey =',
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
