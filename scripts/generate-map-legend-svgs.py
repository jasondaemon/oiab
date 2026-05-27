#!/usr/bin/env python3
"""Generate original SVG map legend reference panels for OIAB Maps v2."""

from __future__ import annotations

import html
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "maps" / "legend"
POI_ICON_OUT = ROOT / "frontend" / "maps" / "icons" / "poi"
POI_MARKER_OUT = ROOT / "frontend" / "maps" / "icons" / "poi-marker"


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def text(x: int, y: int, value: str, size: int = 28, fill: str = "#35403a", weight: int = 400, italic: bool = False) -> str:
    style = "font-style:italic;" if italic else ""
    return f'<text x="{x}" y="{y}" font-family="Aptos, Inter, Arial, sans-serif" font-size="{size}" font-weight="{weight}" fill="{fill}" style="{style}">{esc(value)}</text>'


def line_sample(x: int, y: int, kind: str, color: str = "#555", width: int = 3) -> str:
    if kind == "dash":
        return f'<line x1="{x}" y1="{y}" x2="{x+120}" y2="{y}" stroke="{color}" stroke-width="{width}" stroke-dasharray="12 8"/>'
    if kind == "private":
        return f'{text(x+38, y+5, "Private", 12, "#b89182")}<line x1="{x}" y1="{y}" x2="{x+120}" y2="{y}" stroke="{color}" stroke-width="{width}" stroke-dasharray="12 7"/>'
    if kind == "no-access":
        return f'{text(x+34, y+5, "No Access", 12, "#b89182")}<line x1="{x}" y1="{y}" x2="{x+120}" y2="{y}" stroke="{color}" stroke-width="2" stroke-dasharray="10 7"/>'
    if kind == "dot":
        return f'<line x1="{x}" y1="{y}" x2="{x+120}" y2="{y}" stroke="{color}" stroke-width="{width}" stroke-dasharray="3 5"/>'
    if kind == "double":
        return f'<g stroke="{color}" stroke-width="2" stroke-dasharray="8 5"><line x1="{x}" y1="{y-4}" x2="{x+120}" y2="{y-4}"/><line x1="{x}" y1="{y+4}" x2="{x+120}" y2="{y+4}"/></g>'
    if kind == "ski":
        return '<g>' + "".join(
            f'<line x1="{x}" y1="{y+i*20}" x2="{x+120}" y2="{y+i*20}" stroke="{c}" stroke-width="8" opacity=".42"/>{text(x+42, y+i*20+4, label, 13, c, 700)}'
            for i, (label, c) in enumerate([("Easy", "#16a34a"), ("Intermediate", "#6366f1"), ("Difficult", "#333"), ("Extreme", "#ff5b22")])
        ) + "</g>"
    if kind == "chairlift":
        marks = "".join(f'<line x1="{x+i*24}" y1="{y-4}" x2="{x+i*24}" y2="{y+4}" stroke="#ff5959" stroke-width="1.5"/>' for i in range(6))
        return f'<line x1="{x}" y1="{y}" x2="{x+120}" y2="{y}" stroke="#ff5959" stroke-width="1.5"/>{marks}'
    if kind == "ferry":
        return f'<line x1="{x}" y1="{y}" x2="{x+120}" y2="{y}" stroke="#43b7d8" stroke-width="1.5" stroke-dasharray="10 7"/>'
    if kind == "power":
        return f'<line x1="{x}" y1="{y}" x2="{x+120}" y2="{y}" stroke="#d4b6b6" stroke-width="1.5"/>' + "".join(f'<circle cx="{x+i*36}" cy="{y}" r="2" fill="none" stroke="#d4b6b6"/>' for i in range(4))
    if kind == "rail":
        ticks = "".join(f'<line x1="{x+i*8}" y1="{y-4}" x2="{x+i*8}" y2="{y+4}" stroke="#777" stroke-width="1"/>' for i in range(7))
        ticks += "".join(f'<line x1="{x+70+i*8}" y1="{y-4}" x2="{x+70+i*8}" y2="{y+4}" stroke="#b88545" stroke-width="1"/>' for i in range(7))
        return f'<line x1="{x}" y1="{y}" x2="{x+120}" y2="{y}" stroke="#777"/><line x1="{x+66}" y1="{y-10}" x2="{x+76}" y2="{y+10}" stroke="#333" stroke-width="2"/>{ticks}'
    if kind == "primary":
        return f'<rect x="{x}" y="{y-8}" width="120" height="14" fill="#ffcf4d" stroke="#ff4f2e" stroke-width="2"/>'
    if kind == "secondary":
        return f'<rect x="{x}" y="{y-6}" width="120" height="10" fill="#ffe79c" stroke="#ff8a2a" stroke-width="1.5"/>'
    if kind == "minor":
        return f'<line x1="{x}" y1="{y-3}" x2="{x+120}" y2="{y-3}" stroke="#888"/><line x1="{x}" y1="{y+3}" x2="{x+120}" y2="{y+3}" stroke="#888"/>'
    if kind == "track":
        return f'<line x1="{x}" y1="{y}" x2="{x+120}" y2="{y}" stroke="#999" stroke-width="2" stroke-dasharray="12 7"/><line x1="{x}" y1="{y-7}" x2="{x+120}" y2="{y-7}" stroke="#aaa" stroke-dasharray="12 7"/><line x1="{x}" y1="{y+7}" x2="{x+120}" y2="{y+7}" stroke="#aaa" stroke-dasharray="12 7"/>'
    if kind == "distance":
        return f'<line x1="{x+8}" y1="{y}" x2="{x+112}" y2="{y}" stroke="#666" stroke-width="3" stroke-dasharray="10 7"/><circle cx="{x+5}" cy="{y}" r="6" fill="#666"/><circle cx="{x+115}" cy="{y}" r="6" fill="#666"/>{text(x+50,y-8,"2.3",18,"#666")}'
    if kind == "oneway":
        return f'<line x1="{x}" y1="{y}" x2="{x+120}" y2="{y}" stroke="#333" stroke-width="2" stroke-dasharray="14 8"/>' + "".join(f'<path d="M{x+i*45} {y-7}l16 7-16 7z" fill="#111"/>' for i in range(3))
    return f'<line x1="{x}" y1="{y}" x2="{x+120}" y2="{y}" stroke="{color}" stroke-width="{width}"/>'


def area_sample(x: int, y: int, kind: str, fill: str, stroke: str = "#8ebf8e") -> str:
    if kind == "forest":
        blobs = [
            '<path d="M16 50c5-24 25-28 40-16 12-19 39-10 43 7 20 0 27 24 8 35-12 16-43 8-54 4-26 14-51-3-37-30z" fill="#c5f3a4"/>',
            '<path d="M30 64c7-28 35-30 55-13 10 0 20 8 19 18-20 18-53 12-74-5z" fill="#92d58d"/>',
            '<path d="M61 34c16 4 27 12 31 26-17 2-35-1-48-14 5-8 9-11 17-12z" fill="#d9f6a6"/>',
        ]
        return f'<g transform="translate({x} {y-38})">{"".join(blobs)}</g>'
    if kind == "scree":
        dots = []
        for row in range(16):
            for col in range(18):
                if (row * 7 + col * 11) % 5 != 0:
                    dots.append(f'<circle cx="{x+col*7}" cy="{y-45+row*5}" r=".8" fill="#555" opacity=".45"/>')
        return "".join(dots)
    if kind == "intermittent-water":
        return f'<rect x="{x}" y="{y-34}" width="120" height="55" fill="#eaf8ff"/><path d="M{x+5} {y-28}h110M{x+5} {y-18}h110M{x+5} {y-8}h110M{x+5} {y+2}h110M{x+5} {y+12}h110" stroke="#b7e3f7" stroke-width="1" stroke-dasharray="1 5"/>'
    if kind == "contours":
        paths = []
        for i in range(8):
            paths.append(f'<path d="M{x-8} {y-38+i*10}c28-17 45-17 70 0s48 13 64-3" fill="none" stroke="#dfb69b" stroke-width="1"/>')
        return "".join(paths)
    if kind == "military":
        return "".join(f'<line x1="{x+i*20}" y1="{y+26}" x2="{x+i*20+26}" y2="{y-34}" stroke="#ff6b6b" stroke-width="1.5"/>' for i in range(7))
    if kind == "snow":
        return f'<path d="M{x+12} {y+8}c-6-25 20-49 48-35 26-20 78 1 50 20-28 8-45 39-68 40-13-1-15-21-30-25z" fill="#e8fbfa"/>'
    if kind == "building":
        return f'<path d="M{x} {y-20}h50v-12h42v42H{x+44}v-11H{x}z" fill="#ddd8cf" stroke="#bfb9b0"/>'
    if kind.startswith("box:"):
        return f'<rect x="{x}" y="{y-28}" width="120" height="46" fill="{fill}" stroke="{stroke}" stroke-width="2"/><rect x="{x+4}" y="{y-24}" width="112" height="38" fill="none" stroke="{stroke}" opacity=".25" stroke-width="7"/>'
    return f'<rect x="{x}" y="{y-28}" width="120" height="46" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'


ICON_COLORS = {
    "blue": "#2f75c9",
    "orange": "#d8752b",
    "green": "#438a54",
    "gray": "#555",
    "brown": "#8d7469",
    "purple": "#7d5ab5",
    "red": "#d92929",
    "teal": "#31a8b7",
}


def poi_icon(x: int, y: int, label: str, color: str, key: str) -> str:
    c = ICON_COLORS.get(color, color)
    key = key.lower()
    # Simple original vector symbols. Kept intentionally compact for sprite conversion later.
    if key == "airport":
        return f'<g stroke="{c}" stroke-width="4" stroke-linecap="round" fill="none"><path d="M{x} {y+18}V{y-14}"/><path d="M{x-18} {y}l18-8 18 8"/><path d="M{x-8} {y+15}l8-5 8 5"/></g>'
    if key in {"campground", "campsite", "group-camp"}:
        return f'<path d="M{x-16} {y+18}L{x} {y-18}l16 36z" fill="none" stroke="{c}" stroke-width="5"/><path d="M{x-6} {y+18}L{x} {y+2}l6 16" stroke="{c}" stroke-width="3"/>'
    if key in {"restaurant"}:
        return f'<g stroke="{c}" stroke-width="4" stroke-linecap="round"><path d="M{x-10} {y-18}v36"/><path d="M{x-18} {y-18}v12M{x-10} {y-18}v12M{x-2} {y-18}v12"/><path d="M{x+12} {y-18}v36M{x+12} {y-18}c13 10 10 22 0 24"/></g>'
    if key in {"fast-food", "bakery", "ice-cream"}:
        if key == "ice-cream":
            return f'<path d="M{x-12} {y-2}c0-12 24-12 24 0 0 7-5 11-12 11s-12-4-12-11z" fill="{c}"/><path d="M{x-11} {y+7}h22L{x} {y+28}z" fill="none" stroke="{c}" stroke-width="4" stroke-linejoin="round"/><path d="M{x-7} {y-7}c4-7 12-7 16 0" fill="none" stroke="#fff" stroke-width="3" opacity=".65"/>'
        if key == "bakery":
            return f'<path d="M{x-18} {y+8}c3-18 33-18 36 0v9h-36z" fill="{c}"/><path d="M{x-12} {y+7}c2-7 7-10 12-10s10 3 12 10" fill="none" stroke="#fff" stroke-width="3" opacity=".55"/>'
        return f'<path d="M{x-16} {y-2}h32v10c0 8-32 8-32 0z" fill="{c}"/><path d="M{x-10} {y-8}h20" stroke="{c}" stroke-width="5" stroke-linecap="round"/>'
    if key in {"bar", "pub-brewery"}:
        return f'<path d="M{x-14} {y-16}h28l-6 18h-16z" fill="none" stroke="{c}" stroke-width="4"/><path d="M{x} {y+2}v16M{x-10} {y+18}h20" stroke="{c}" stroke-width="4"/>'
    if key in {"cafe"}:
        return f'<path d="M{x-16} {y-8}h24v14a12 12 0 0 1-24 0z" fill="none" stroke="{c}" stroke-width="4"/><path d="M{x+8} {y-4}h8a6 6 0 0 1 0 12h-8" fill="none" stroke="{c}" stroke-width="4"/><path d="M{x-18} {y+18}h36" stroke="{c}" stroke-width="4"/>'
    if key in {"gas-station-ev-station"}:
        return f'<rect x="{x-17}" y="{y-18}" width="20" height="34" rx="3" fill="none" stroke="#d8752b" stroke-width="4"/><path d="M{x+4} {y-12}h9l7 8v19" fill="none" stroke="#20aeb8" stroke-width="4"/><path d="M{x-12} {y-10}h10M{x+13} {y+4}l-8 10h11" stroke="#20aeb8" stroke-width="3"/>'
    if key in {"parking", "bicycle-parking"}:
        return f'{text(x-11, y+11, "P", 30, c, 800)}'
    if key in {"restrooms"}:
        return f'<circle cx="{x-8}" cy="{y-12}" r="4" fill="{c}"/><circle cx="{x+10}" cy="{y-12}" r="4" fill="{c}"/><path d="M{x-16} {y+18}l6-24h4l6 24M{x+3} {y+18}V{y-2}h14v20" fill="none" stroke="{c}" stroke-width="4" stroke-linecap="round"/>'
    if key in {"medical-clinic-hospital", "pharmacy"}:
        return f'<circle cx="{x}" cy="{y}" r="17" fill="none" stroke="{c}" stroke-width="4"/><path d="M{x-11} {y}h22M{x} {y-11}v22" stroke="{c}" stroke-width="5"/>'
    if key in {"library"}:
        return f'<path d="M{x-18} {y-14}c10-4 16 0 18 5 2-5 8-9 18-5v28c-10-4-16 0-18 5-2-5-8-9-18-5z" fill="none" stroke="{c}" stroke-width="3"/>'
    if key in {"lookout-tower"}:
        return f'<path d="M{x-12} {y+18}l12-36 12 36M{x-9} {y-4}h18M{x-14} {y-18}h28v8h-28z" fill="none" stroke="{c}" stroke-width="3"/>'
    if key in {"waterfall", "hotspring", "spring"}:
        return f'<path d="M{x-14} {y-16}c0 13-9 13-9 26M{x} {y-16}c0 13-9 13-9 26M{x+14} {y-16}c0 13-9 13-9 26" fill="none" stroke="{c}" stroke-width="4" stroke-linecap="round"/>'
    if key == "information":
        return f'<circle cx="{x}" cy="{y}" r="17" fill="none" stroke="{c}" stroke-width="4"/>{text(x-4, y+9, "i", 24, c, 800)}'
    if key == "hazard":
        return f'<path d="M{x} {y-21}l23 40h-46z" fill="none" stroke="{c}" stroke-width="4" stroke-linejoin="round"/><path d="M{x} {y-8}v14M{x} {y+13}v.1" stroke="{c}" stroke-width="5" stroke-linecap="round"/>'
    if key == "photo":
        return f'<rect x="{x-19}" y="{y-14}" width="38" height="29" rx="4" fill="none" stroke="{c}" stroke-width="4"/><path d="M{x-10} {y-14}l4-7h12l4 7" fill="none" stroke="{c}" stroke-width="4" stroke-linejoin="round"/><circle cx="{x}" cy="{y+1}" r="8" fill="none" stroke="{c}" stroke-width="4"/><circle cx="{x+12}" cy="{y-7}" r="2" fill="{c}"/>'
    if key == "fishing":
        return f'<path d="M{x-18} {y}c10-14 27-14 38 0-11 14-28 14-38 0z" fill="none" stroke="{c}" stroke-width="4"/><path d="M{x+20} {y}l10-9v18zM{x-2} {y-7}l5 7-5 7" fill="none" stroke="{c}" stroke-width="4" stroke-linejoin="round"/><circle cx="{x-11}" cy="{y-1}" r="2" fill="{c}"/>'
    if key == "lighthouse":
        return f'<path d="M{x-11} {y+19}l4-27h14l4 27z" fill="none" stroke="{c}" stroke-width="4" stroke-linejoin="round"/><path d="M{x-12} {y-8}h24M{x-8} {y-18}h16v10h-16zM{x-24} {y-12}h10M{x+14} {y-12}h10M{x-18} {y+19}h36" stroke="{c}" stroke-width="4" fill="none" stroke-linecap="round"/>'
    if key == "fee-booth":
        return f'<path d="M{x-17} {y+18}h34M{x-12} {y+18}v-24h24v24M{x-17} {y-6}L{x} {y-18}l17 12" fill="none" stroke="{c}" stroke-width="4" stroke-linejoin="round"/>{text(x-5, y+10, "$", 16, c, 800)}'
    if key == "food-box":
        return f'<rect x="{x-16}" y="{y-16}" width="32" height="30" rx="3" fill="none" stroke="{c}" stroke-width="4"/><path d="M{x-9} {y-16}v-6h18v6M{x-8} {y-2}h16M{x-8} {y+8}h16" stroke="{c}" stroke-width="3"/>'
    if key == "gate":
        return f'<path d="M{x-19} {y+12}V{y-10}M{x+19} {y+12}V{y-10}M{x-19} {y-2}h38M{x-12} {y-10}v22M{x} {y-10}v22M{x+12} {y-10}v22" fill="none" stroke="{c}" stroke-width="4" stroke-linecap="round"/>'
    if key == "geyser":
        return f'<path d="M{x-4} {y+18}h8M{x} {y+17}v-14M{x-17} {y+12}c9-2 13-8 13-18M{x+17} {y+12}c-9-2-13-8-13-18M{x-8} {y+2}c-4-10 2-18 8-24 6 6 12 14 8 24" fill="none" stroke="{c}" stroke-width="4" stroke-linecap="round"/>'
    if key == "lodging":
        return f'<path d="M{x-20} {y+14}V{y-14}M{x-20} {y+2}h40v12M{x-13} {y-4}h12a8 8 0 0 1 8 8v10" fill="none" stroke="{c}" stroke-width="4" stroke-linecap="round"/><circle cx="{x-10}" cy="{y-8}" r="4" fill="{c}"/>'
    if key == "mine-quarry":
        return f'<path d="M{x-17} {y+16}l14-14M{x+17} {y+16}L{x+3} {y+2}M{x-8} {y-8}l16-10M{x-13} {y-13}l10 10M{x+13} {y-13}l-10 10" stroke="{c}" stroke-width="4" stroke-linecap="round"/>'
    if key == "police-station":
        return f'<path d="M{x} {y-20}l17 6v12c0 12-7 20-17 24-10-4-17-12-17-24v-12z" fill="none" stroke="{c}" stroke-width="4"/><path d="M{x-8} {y-2}h16M{x} {y-10}v16" stroke="{c}" stroke-width="4"/>'
    if key == "ranger-station":
        return f'<path d="M{x-17} {y+18}v-25h34v25M{x-21} {y-7}L{x} {y-21}l21 14M{x-6} {y+18}V{y+5}h12v13" fill="none" stroke="{c}" stroke-width="4" stroke-linejoin="round"/><circle cx="{x}" cy="{y-4}" r="3" fill="{c}"/>'
    if key == "rock-boulder":
        return f'<path d="M{x-17} {y+16}l-5-16 10-14 18-5 16 12 1 15-13 12z" fill="none" stroke="{c}" stroke-width="4" stroke-linejoin="round"/><path d="M{x-8} {y-13}l5 12 14-6M{x-14} {y+2}l12 3" stroke="{c}" stroke-width="3"/>'
    if key == "rv-camping":
        return f'<path d="M{x-21} {y+9}V{y-9}h30l12 10v8z" fill="none" stroke="{c}" stroke-width="4" stroke-linejoin="round"/><circle cx="{x-11}" cy="{y+13}" r="4" fill="{c}"/><circle cx="{x+12}" cy="{y+13}" r="4" fill="{c}"/><path d="M{x-14} {y-3}h10M{x+4} {y-4}h8" stroke="{c}" stroke-width="3"/>'
    if key == "shelter":
        return f'<path d="M{x-20} {y-2}L{x} {y-17}l20 15M{x-14} {y-2}v20M{x+14} {y-2}v20M{x-18} {y+18}h36" fill="none" stroke="{c}" stroke-width="4" stroke-linejoin="round"/>'
    if key == "ski-area":
        return f'<rect x="{x-18}" y="{y-18}" width="36" height="36" rx="5" fill="none" stroke="{c}" stroke-width="3"/><path d="M{x-10} {y-10}l20 20M{x+10} {y-10}l-20 20M{x-14} {y+15}c10 5 21 5 28 0" fill="none" stroke="{c}" stroke-width="3" stroke-linecap="round"/>'
    if key == "swimming-area":
        return f'<path d="M{x-17} {y+11}c6-5 12-5 18 0s12 5 18 0M{x-17} {y+21}c6-5 12-5 18 0s12 5 18 0M{x-5} {y-10}l9 8 8-4M{x-3} {y-6}l-9 12" fill="none" stroke="{c}" stroke-width="4" stroke-linecap="round"/>'
    if key == "theater":
        return f'<path d="M{x-20} {y-14}c9 4 17 4 26 0v12c0 13-9 19-13 20-5-2-13-8-13-20zM{x+2} {y-14}c9 4 17 4 26 0v12c0 13-9 19-13 20-5-2-13-8-13-20z" fill="none" stroke="{c}" stroke-width="3"/><circle cx="{x-12}" cy="{y-4}" r="1.8" fill="{c}"/><circle cx="{x-2}" cy="{y-4}" r="1.8" fill="{c}"/><path d="M{x-13} {y+7}c4 3 8 3 12 0M{x+10} {y+8}c4-3 8-3 12 0" stroke="{c}" stroke-width="2" fill="none"/>'
    if key == "theme-park":
        return f'<circle cx="{x}" cy="{y}" r="17" fill="none" stroke="{c}" stroke-width="3"/><circle cx="{x}" cy="{y}" r="4" fill="{c}"/>' + "".join(f'<line x1="{x}" y1="{y}" x2="{x+16*__import__("math").cos(a)}" y2="{y+16*__import__("math").sin(a)}" stroke="{c}" stroke-width="3"/>' for a in [0, .785, 1.57, 2.355, 3.14, 3.925, 4.71, 5.495])
    if key == "visitor-center":
        return f'<rect x="{x-17}" y="{y-18}" width="34" height="36" rx="4" fill="none" stroke="{c}" stroke-width="4"/>{text(x-4, y+7, "i", 22, c, 800)}<path d="M{x-9} {y+17}h18" stroke="{c}" stroke-width="4"/>'
    if key == "volcano":
        return f'<path d="M{x-20} {y+18}l13-24 7 8 7-8 13 24z" fill="none" stroke="{c}" stroke-width="4" stroke-linejoin="round"/><path d="M{x-8} {y-12}c-7-8 8-8 0-17M{x+4} {y-12}c-7-8 8-8 0-17" fill="none" stroke="{c}" stroke-width="3" stroke-linecap="round"/>'
    if key == "xc-ski-area":
        return f'<path d="M{x-17} {y+16}c13 5 26 5 38 0M{x-11} {y-13}l13 11 13-11M{x-3} {y-2}l-11 14M{x+4} {y-2}l12 14" fill="none" stroke="{c}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
    if key == "alpine-hut":
        return f'<rect x="{x-17}" y="{y-4}" width="34" height="22" rx="2" fill="none" stroke="{c}" stroke-width="4"/><path d="M{x-22} {y-4}L{x} {y-22}l22 18M{x-7} {y+18}V{y+5}h14v13M{x-13} {y-16}v-8h7" fill="none" stroke="{c}" stroke-width="4" stroke-linejoin="round"/>'
    if key == "amphitheater":
        return f'<path d="M{x-18} {y+14}h36M{x-14} {y+6}h28M{x-10} {y-2}h20M{x-6} {y-10}h12" stroke="{c}" stroke-width="4" stroke-linecap="round"/><path d="M{x-20} {y+18}c3-25 37-25 40 0" fill="none" stroke="{c}" stroke-width="3"/>'
    if key == "attraction":
        return f'<path d="M{x} {y-20}l5 14 15 1-12 9 4 15-12-8-12 8 4-15-12-9 15-1z" fill="{c}"/>'
    if key == "bike-shop":
        return f'<circle cx="{x-13}" cy="{y+10}" r="9" fill="none" stroke="{c}" stroke-width="4"/><circle cx="{x+15}" cy="{y+10}" r="9" fill="none" stroke="{c}" stroke-width="4"/><path d="M{x-13} {y+10}l10-18h10l8 18M{x-3} {y-8}l-10 18M{x-3} {y-8}l18 18M{x-5} {y-13}h12" fill="none" stroke="{c}" stroke-width="3" stroke-linecap="round"/>'
    if key == "bus-station":
        return f'<rect x="{x-15}" y="{y-19}" width="30" height="34" rx="6" fill="none" stroke="{c}" stroke-width="4"/><path d="M{x-9} {y-8}h18M{x-9} {y+3}h18M{x-10} {y+18}v5M{x+10} {y+18}v5" stroke="{c}" stroke-width="4" stroke-linecap="round"/><circle cx="{x-8}" cy="{y+10}" r="2.5" fill="{c}"/><circle cx="{x+8}" cy="{y+10}" r="2.5" fill="{c}"/>'
    if key == "cave-entrance":
        return f'<path d="M{x-20} {y+17}c2-24 16-35 40 0M{x-10} {y+17}c1-12 8-18 20 0" fill="none" stroke="{c}" stroke-width="4" stroke-linejoin="round"/><path d="M{x-15} {y+17}h30" stroke="{c}" stroke-width="4" stroke-linecap="round"/>'
    if key == "cinema":
        return f'<rect x="{x-17}" y="{y-7}" width="25" height="20" rx="3" fill="none" stroke="{c}" stroke-width="4"/><path d="M{x+8} {y-2}l15-9v28l-15-9z" fill="none" stroke="{c}" stroke-width="4" stroke-linejoin="round"/><circle cx="{x-11}" cy="{y-18}" r="5" fill="none" stroke="{c}" stroke-width="3"/><circle cx="{x}" cy="{y-19}" r="4" fill="none" stroke="{c}" stroke-width="3"/>'
    if key == "climbing-area":
        return f'<path d="M{x-18} {y+19}l9-31 11 10 8-15 10 36z" fill="none" stroke="{c}" stroke-width="4" stroke-linejoin="round"/><circle cx="{x-1}" cy="{y-15}" r="3" fill="{c}"/><path d="M{x-1} {y-11}l-9 12M{x-1} {y-11}l11 9M{x-10} {y+1}l-6 12M{x+10} {y-2}l8 12" stroke="{c}" stroke-width="3" stroke-linecap="round"/>'
    if key == "drinking-water":
        return f'<path d="M{x-9} {y-13}h18l-3 31h-12z" fill="none" stroke="{c}" stroke-width="4" stroke-linejoin="round"/><path d="M{x-14} {y-20}h28M{x} {y-20}v7M{x-5} {y-4}h10" stroke="{c}" stroke-width="4" stroke-linecap="round"/>'
    if key == "entrance-station":
        return f'<path d="M{x-18} {y+18}v-26h12v26M{x-6} {y-8}h24v26M{x-22} {y-8}L{x} {y-21}l22 13" fill="none" stroke="{c}" stroke-width="4" stroke-linejoin="round"/><path d="M{x+3} {y+18}V{y+5}h8v13" stroke="{c}" stroke-width="3"/>'
    if key == "ferry-terminal":
        return f'<path d="M{x-17} {y+4}h34l-5 12h-24z" fill="none" stroke="{c}" stroke-width="4" stroke-linejoin="round"/><path d="M{x-10} {y+20}c6-4 12-4 18 0s11 4 16 0M{x-8} {y+4}v-18h16v18M{x-16} {y-4}h32" fill="none" stroke="{c}" stroke-width="3" stroke-linecap="round"/>'
    if key == "golf-course":
        return f'<path d="M{x-8} {y+20}V{y-18}l22 7-22 7" fill="none" stroke="{c}" stroke-width="4" stroke-linejoin="round"/><path d="M{x-18} {y+20}h26" stroke="{c}" stroke-width="4" stroke-linecap="round"/><circle cx="{x+15}" cy="{y+12}" r="3" fill="{c}"/>'
    if key == "horseback-riding":
        return f'<path d="M{x-20} {y+4}c7-14 23-14 34-4l10-5 4 8-8 8h-9l-4 10M{x-10} {y+3}l-6 18M{x+1} {y+4}l5 17" fill="none" stroke="{c}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="{x+18}" cy="{y-9}" r="3" fill="{c}"/>'
    if key == "picnic-area":
        return f'<path d="M{x-20} {y}h40M{x-14} {y+8}h28M{x-10} {y}l-8 18M{x+10} {y}l8 18M{x-6} {y+8}l-4 10M{x+6} {y+8}l4 10" stroke="{c}" stroke-width="4" stroke-linecap="round"/>'
    if key == "playground":
        return f'<path d="M{x-19} {y+18}L{x-6} {y-18}M{x+19} {y+18}L{x+6} {y-18}M{x-7} {y-18}h14M{x-8} {y-3}h16M{x-8} {y-18}v15M{x+8} {y-18}v15" fill="none" stroke="{c}" stroke-width="4" stroke-linecap="round"/><path d="M{x-8} {y-3}c0 8 16 8 16 0" fill="none" stroke="{c}" stroke-width="3"/>'
    if key == "train-station":
        return f'<rect x="{x-14}" y="{y-19}" width="28" height="32" rx="5" fill="none" stroke="{c}" stroke-width="4"/><path d="M{x-8} {y-8}h16M{x-8} {y+2}h16M{x-18} {y+22}l10-9M{x+18} {y+22}l-10-9M{x-14} {y+22}h28" stroke="{c}" stroke-width="4" stroke-linecap="round"/><circle cx="{x-7}" cy="{y+9}" r="2.5" fill="{c}"/><circle cx="{x+7}" cy="{y+9}" r="2.5" fill="{c}"/>'
    if key == "viewpoint":
        return f'<path d="M{x-21} {y}c12-15 30-15 42 0-12 15-30 15-42 0z" fill="none" stroke="{c}" stroke-width="4"/><circle cx="{x}" cy="{y}" r="7" fill="none" stroke="{c}" stroke-width="4"/>'
    if key in {"trailhead", "outdoor-store"}:
        return f'<path d="M{x-8} {y+18}l8-32 8 32M{x-15} {y+2}h30" fill="none" stroke="{c}" stroke-width="5" stroke-linecap="round"/>'
    if key in {"school", "college-university", "museum"}:
        return f'<path d="M{x-18} {y-4}L{x} {y-17}l18 13zM{x-14} {y-2}v18M{x} {y-2}v18M{x+14} {y-2}v18M{x-18} {y+18}h36" fill="none" stroke="{c}" stroke-width="4"/>'
    if key in {"beach"}:
        return f'<path d="M{x-16} {y-1}c10-16 24-16 32 0-12-5-19-2-32 0z" fill="{c}"/><path d="M{x} {y}v18" stroke="{c}" stroke-width="4"/>'
    if key in {"marina", "canoe-launch", "slipway-boat-launch"}:
        return f'<path d="M{x} {y-18}v32M{x-11} {y+2}c3 10 19 10 22 0M{x-10} {y-4}h20" fill="none" stroke="{c}" stroke-width="4" stroke-linecap="round"/>'
    if key in {"fire-station"}:
        return f'<path d="M{x} {y-20}c13 12 12 26 0 36-12-10-12-22 0-36z" fill="{c}" opacity=".9"/><path d="M{x+2} {y+3}c5 5 3 11-2 14-5-4-6-9 2-14z" fill="#fff" opacity=".75"/>'
    if key in {"dog-park"}:
        return f'<circle cx="{x}" cy="{y}" r="6" fill="{c}"/><circle cx="{x-13}" cy="{y-10}" r="5" fill="{c}"/><circle cx="{x+13}" cy="{y-10}" r="5" fill="{c}"/><circle cx="{x-10}" cy="{y+12}" r="5" fill="{c}"/><circle cx="{x+10}" cy="{y+12}" r="5" fill="{c}"/>'
    if key in {"peak-summit"}:
        return f'<path d="M{x-18} {y+16}L{x} {y-18}l18 34z" fill="none" stroke="{c}" stroke-width="5"/><path d="M{x-5} {y-6}l5 5 5-5" stroke="{c}" stroke-width="3" fill="none"/>'
    if key in {"shopping", "grocery-store"}:
        return f'<path d="M{x-15} {y-3}h30l-4 20h-22z" fill="none" stroke="{c}" stroke-width="4"/><path d="M{x-8} {y-3}c0-15 16-15 16 0" fill="none" stroke="{c}" stroke-width="4"/>'
    if key in {"bank", "atm", "post-office"}:
        return f'<rect x="{x-14}" y="{y-12}" width="28" height="24" rx="4" fill="none" stroke="{c}" stroke-width="4"/>{text(x-8, y+8, "$" if key!="post-office" else "✉", 20, c, 800)}'
    if key in {"garden"}:
        return f'<path d="M{x} {y+18}V{y-6}M{x} {y-5}c-16-14-22 4-5 7M{x} {y-7}c18-12 22 7 4 8" fill="none" stroke="{c}" stroke-width="4"/>'
    if key in {"zoo"}:
        return f'<path d="M{x-16} {y+14}c2-24 28-24 32 0M{x-8} {y-7}h.1M{x+8} {y-7}h.1M{x-5} {y+5}c4 3 7 3 10 0" fill="none" stroke="{c}" stroke-width="4" stroke-linecap="round"/>'
    letters = "".join(part[0] for part in label.replace("/", " ").split()[:2]).upper()
    return f'<circle cx="{x}" cy="{y}" r="17" fill="none" stroke="{c}" stroke-width="4"/>{text(x-9, y+7, letters[:2], 14, c, 800)}'


LINE_AREA_LEFT = [
    ("trail", "Trail", "dash"),
    ("private-trail", "Privately Maintained Trail", "private"),
    ("no-public-access-trail", "Trail with No Public Access", "no-access"),
    ("alpine-hiking-route", "Alpine Hiking Route", "dot"),
    ("double-track-trail", "Double Track Trail", "double"),
    ("ski-run-trail", "Ski Run / Ski Trail", "ski"),
    ("chairlift", "Chairlift", "chairlift"),
    ("ferry-route", "Ferry Route", "ferry"),
    ("powerlines", "Powerlines", "power"),
    ("railroad", "Railroad: Active / Abandoned", "rail"),
    ("forest-cover", "Forest Cover: Tree / Shrub", "area:forest"),
    ("scree-lava-flow", "Scree / Lava Flow", "area:scree"),
    ("intermittent-waterbody", "Intermittent Waterbody", "area:intermittent-water"),
    ("contours", "Contours", "area:contours"),
    ("military-area", "Military Area", "area:military"),
    ("snow-ice", "Snow / Ice", "area:snow"),
    ("building-structure", "Building / Structure", "area:building"),
]

LINE_AREA_RIGHT = [
    ("primary-road", "Primary Road / Interstate", "primary"),
    ("secondary-road", "Secondary Road / Highway", "secondary"),
    ("minor-road", "Minor Road / Street", "minor"),
    ("track-road", "Track / Unmaintained Road / High Clearance Road", "track"),
    ("trail-distance", "Trail / Track Distance", "distance"),
    ("one-way", "One Way Trail / Road", "oneway"),
    ("national-forest", "National Forest", "box:#e5f4e8:#6dc476"),
    ("national-park", "National Park / National Recreation Area", "box:#efe6da:#c7b49c"),
    ("state-park", "State Park", "box:#ffe2e1:#ef9aa2"),
    ("blm", "Bureau of Land Management (BLM)", "box:#fffbd0:#d8d074"),
    ("state-land", "State Land", "box:#efedff:#c3b9f0"),
    ("wildlife-area", "Wildlife Area", "box:#fbedd7:#d9b36a"),
    ("marine-protection", "Marine Protection Area", "box:#d9f4fb:#84cadd"),
    ("wilderness", "Wilderness / Wilderness Study Area", "box:#d7ecd7:#7aa87a"),
    ("other-protected", "Other Park / Protected Area", "box:#daf7ed:#8ed9c5"),
]

POIS = [
    ("airport", "Airport", "blue"), ("alpine-hut", "Alpine Hut / Cabin / Chalet", "gray"), ("amphitheater", "Amphitheater", "gray"),
    ("atm", "ATM", "brown"), ("attraction", "Attraction", "purple"), ("bakery", "Bakery", "orange"),
    ("bank", "Bank", "brown"), ("bar", "Bar", "orange"), ("beach", "Beach", "gray"),
    ("bicycle-parking", "Bicycle Parking", "gray"), ("bike-shop", "Bike Shop", "orange"), ("bus-station", "Bus Station", "blue"),
    ("cafe", "Cafe", "orange"), ("campground", "Campground", "gray"), ("campsite", "Campsite", "gray"),
    ("canoe-launch", "Canoe Launch", "gray"), ("cave-entrance", "Cave Entrance", "gray"), ("cinema", "Cinema", "purple"),
    ("climbing-area", "Climbing Area", "gray"), ("college-university", "College / University", "brown"), ("dog-park", "Dog Park", "green"),
    ("drinking-water", "Drinking Water", "teal"), ("entrance-station", "Entrance Station", "gray"), ("fast-food", "Fast Food", "orange"),
    ("fee-booth", "Fee Booth", "gray"), ("ferry-terminal", "Ferry Terminal", "blue"), ("fire-station", "Fire Station", "brown"),
    ("fishing", "Fishing", "gray"), ("food-box", "Food Box", "gray"), ("garden", "Garden", "green"),
    ("gas-station-ev-station", "Gas Station / EV Station", "orange"), ("gate", "Gate", "gray"), ("geyser", "Geyser", "teal"),
    ("golf-course", "Golf Course", "green"), ("grocery-store", "Grocery Store", "orange"), ("group-camp", "Group Camp", "gray"),
    ("horseback-riding", "Horseback Riding", "gray"), ("hotspring", "Hotspring", "teal"), ("ice-cream", "Ice Cream", "orange"),
    ("information", "Information", "gray"), ("library", "Library", "brown"), ("lighthouse", "Lighthouse", "gray"),
    ("lodging", "Lodging", "blue"), ("lookout-tower", "Lookout Tower", "gray"), ("marina", "Marina", "gray"),
    ("medical-clinic-hospital", "Medical Clinic / Hospital", "red"), ("mine-quarry", "Mine / Quarry", "gray"), ("museum", "Museum", "purple"),
    ("outdoor-store", "Outdoor Store", "orange"), ("parking", "Parking", "gray"), ("peak-summit", "Peak / Summit", "brown"),
    ("picnic-area", "Picnic Area", "gray"), ("pharmacy", "Pharmacy", "red"), ("playground", "Playground", "green"),
    ("police-station", "Police Station", "brown"), ("post-office", "Post Office", "brown"), ("pub-brewery", "Pub / Brewery", "orange"),
    ("ranger-station", "Ranger Station", "gray"), ("restaurant", "Restaurant", "orange"), ("restrooms", "Restrooms", "gray"),
    ("rock-boulder", "Rock / Boulder", "gray"), ("rv-camping", "RV Camping", "gray"), ("school", "School", "brown"),
    ("shelter", "Shelter", "gray"), ("shopping", "Shopping", "orange"), ("ski-area", "Ski Area", "gray"),
    ("slipway-boat-launch", "Slipway / Boat Launch", "gray"), ("spring", "Spring", "teal"), ("swimming-area", "Swimming Area", "gray"),
    ("theater", "Theater", "purple"), ("theme-park", "Theme Park", "purple"), ("trailhead", "Trailhead", "gray"),
    ("train-station", "Train Station", "blue"), ("viewpoint", "Viewpoint", "gray"), ("visitor-center", "Visitor Center", "gray"),
    ("volcano", "Volcano", "brown"), ("waterfall", "Waterfall", "teal"), ("xc-ski-area", "XC Ski Area", "gray"),
    ("zoo", "Zoo", "purple"),
]

WAYPOINT_EXTRA_POIS = [
    ("hazard", "Hazard", "red"),
    ("photo", "Photo", "blue"),
]


def line_area_svg() -> str:
    rows = []
    y = 56
    for key, label, kind in LINE_AREA_LEFT:
        if kind.startswith("area:"):
            rows.append(area_sample(24, y, kind.split(":", 1)[1], "#ddd"))
        else:
            rows.append(line_sample(24, y, kind, "#555"))
        rows.append(text(165, y + 9, label.split(":")[0], 27))
        if ":" in label:
            rows.append(text(165, y + 36, label.split(":", 1)[1].strip(), 19, "#35403a", italic=True))
            y += 94
        elif kind == "ski":
            y += 112
        else:
            y += 43
    y = 56
    for key, label, kind in LINE_AREA_RIGHT:
        if kind.startswith("box:"):
            _, fill, stroke = kind.split(":")
            rows.append(area_sample(585, y, "box:", fill, stroke))
        else:
            rows.append(line_sample(585, y, kind, "#555"))
        parts = label.split(" / ")
        if len(label) > 27:
            rows.append(text(730, y - 6, parts[0] + (" /" if len(parts) > 1 else ""), 27))
            rows.append(text(730, y + 25, " / ".join(parts[1:]) if len(parts) > 1 else label[27:], 27))
            y += 78
        else:
            rows.append(text(730, y + 9, label, 27))
            y += 76 if kind.startswith("box:") else 56
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1280" role="img" aria-label="OIAB line and area map legend">
  <rect width="1024" height="1280" fill="#fff"/>
  <g>{''.join(rows)}</g>
</svg>
'''


def poi_entries() -> list[tuple[str, str, str]]:
    return POIS + WAYPOINT_EXTRA_POIS


def poi_svg() -> str:
    rows = []
    col_x = [48, 418, 790]
    label_x = [92, 462, 835]
    row_y = [34 + i * 58 for i in range(27)]
    for idx, (key, label, color) in enumerate(POIS):
        col = idx // 27
        row = idx % 27
        x = col_x[col]
        y = row_y[row]
        rows.append(poi_icon(x, y, label, color, key))
        if len(label) > 22:
            first, rest = label.split(" / ", 1) if " / " in label else (label[:22], label[22:])
            rows.append(text(label_x[col], y - 2, first + (" /" if " / " in label else ""), 25))
            rows.append(text(label_x[col], y + 28, rest, 25))
        else:
            rows.append(text(label_x[col], y + 8, label, 25))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 1600" role="img" aria-label="OIAB point of interest map legend">
  <rect width="1120" height="1600" fill="#fff"/>
  <g>{''.join(rows)}</g>
</svg>
'''


def catalog() -> dict:
    return {
        "schema": 1,
        "name": "OIAB Map Legend Reference Pack",
        "notes": [
            "Original SVG redraws inspired by user-provided legend screenshots.",
            "Some entries are placeholders for future overlays such as USGS/topo/public lands.",
            "This catalog is a design source; MapLibre style wiring is a separate step.",
        ],
        "line_area": [{"id": key, "label": label, "sample": kind} for key, label, kind in LINE_AREA_LEFT + LINE_AREA_RIGHT],
        "poi": [{"id": key, "label": label, "color": ICON_COLORS.get(color, color)} for key, label, color in poi_entries()],
    }


def individual_poi_svg(key: str, label: str, color: str) -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="{esc(label)}">
  <rect width="64" height="64" fill="none"/>
  <g>{poi_icon(32, 32, label, color, key)}</g>
</svg>
'''


def marker_poi_svg(key: str, label: str, color: str) -> str:
    border = ICON_COLORS.get(color, color)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" role="img" aria-label="{esc(label)} marker">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0b170f" flood-opacity=".28"/>
    </filter>
  </defs>
  <circle cx="40" cy="40" r="31" fill="#f8fbf6" stroke="{esc(border)}" stroke-width="5" filter="url(#shadow)"/>
  <g transform="translate(8 8)">{poi_icon(32, 32, label, "#173125", key)}</g>
</svg>
'''


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    POI_ICON_OUT.mkdir(parents=True, exist_ok=True)
    POI_MARKER_OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "oiab-line-area-legend.svg").write_text(line_area_svg(), encoding="utf-8")
    (OUT / "oiab-poi-legend.svg").write_text(poi_svg(), encoding="utf-8")
    (OUT / "legend-catalog.json").write_text(json.dumps(catalog(), indent=2), encoding="utf-8")
    for key, label, color in poi_entries():
        (POI_ICON_OUT / f"{key}.svg").write_text(individual_poi_svg(key, label, color), encoding="utf-8")
        (POI_MARKER_OUT / f"{key}.svg").write_text(marker_poi_svg(key, label, color), encoding="utf-8")


if __name__ == "__main__":
    main()
