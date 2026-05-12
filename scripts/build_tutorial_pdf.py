#!/usr/bin/env python3
"""Build a polished TUTORIAL.pdf from TUTORIAL.md with Stine branding.

Usage: python3 scripts/build_tutorial_pdf.py
"""

from __future__ import annotations

import datetime
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.flowables import HRFlowable

ROOT = Path(__file__).resolve().parent.parent
LOGO = ROOT / "assets" / "stine-logo.jpeg"
SRC = ROOT / "TUTORIAL.md"
OUT = ROOT / "TUTORIAL.pdf"

STINE_GREEN = colors.HexColor("#1a9d37")
STINE_GREEN_DARK = colors.HexColor("#147a2a")
STINE_GREEN_SOFT = colors.HexColor("#e6f5ea")
STINE_ORANGE = colors.HexColor("#d94e27")
INK = colors.HexColor("#1f2937")
MUTED = colors.HexColor("#6b7280")
ZEBRA = colors.HexColor("#f6f8f7")

PAGE_W, PAGE_H = LETTER


# ---------- inline markdown helpers ----------

def inline(text: str) -> str:
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r"`([^`]+)`", r'<font face="Courier" color="#147a2a">\1</font>', text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"\*([^*]+)\*", r"<i>\1</i>", text)
    return text


# ---------- page chrome ----------

def _logo_dims(target_w):
    img = Image(str(LOGO))
    ratio = img.imageHeight / img.imageWidth
    return target_w, target_w * ratio


def draw_cover_background(c: Canvas, doc):
    # top color band
    band_h = 0.45 * inch
    c.setFillColor(STINE_GREEN)
    c.rect(0, PAGE_H - band_h, PAGE_W, band_h, stroke=0, fill=1)
    c.setFillColor(STINE_ORANGE)
    c.rect(0, PAGE_H - band_h - 0.08 * inch, PAGE_W, 0.08 * inch, stroke=0, fill=1)

    # bottom color band
    c.setFillColor(STINE_GREEN)
    c.rect(0, 0, PAGE_W, band_h, stroke=0, fill=1)
    c.setFillColor(STINE_ORANGE)
    c.rect(0, band_h, PAGE_W, 0.08 * inch, stroke=0, fill=1)

    # footer text in bottom band
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(PAGE_W / 2, band_h / 2 - 3, "Project Manager  ·  User Tutorial")


def draw_content_chrome(c: Canvas, doc):
    # small logo at top-left
    lw, lh = _logo_dims(1.1 * inch)
    c.drawImage(
        str(LOGO),
        0.6 * inch,
        PAGE_H - 0.55 * inch - lh,
        width=lw,
        height=lh,
        mask="auto",
        preserveAspectRatio=True,
    )

    # title on the right
    c.setFillColor(STINE_GREEN_DARK)
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(PAGE_W - 0.6 * inch, PAGE_H - 0.55 * inch, "Project Manager")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9)
    c.drawRightString(PAGE_W - 0.6 * inch, PAGE_H - 0.7 * inch, "User Tutorial")

    # divider line
    c.setStrokeColor(STINE_GREEN)
    c.setLineWidth(1.2)
    c.line(0.6 * inch, PAGE_H - 0.95 * inch, PAGE_W - 0.6 * inch, PAGE_H - 0.95 * inch)
    c.setStrokeColor(STINE_ORANGE)
    c.setLineWidth(0.6)
    c.line(0.6 * inch, PAGE_H - 0.99 * inch, 2.0 * inch, PAGE_H - 0.99 * inch)

    # footer
    c.setStrokeColor(colors.HexColor("#e5e7eb"))
    c.setLineWidth(0.5)
    c.line(0.6 * inch, 0.55 * inch, PAGE_W - 0.6 * inch, 0.55 * inch)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8.5)
    year = datetime.date.today().year
    c.drawString(0.6 * inch, 0.38 * inch, f"© {year} Stine")
    c.drawRightString(PAGE_W - 0.6 * inch, 0.38 * inch, f"Page {doc.page - 1}")


# ---------- styles ----------

styles = {
    "title": ParagraphStyle(
        "title",
        fontName="Helvetica-Bold",
        fontSize=34,
        leading=40,
        textColor=STINE_GREEN_DARK,
        alignment=TA_CENTER,
    ),
    "subtitle": ParagraphStyle(
        "subtitle",
        fontName="Helvetica",
        fontSize=16,
        leading=20,
        textColor=INK,
        alignment=TA_CENTER,
    ),
    "tagline": ParagraphStyle(
        "tagline",
        fontName="Helvetica-Oblique",
        fontSize=11,
        leading=15,
        textColor=MUTED,
        alignment=TA_CENTER,
    ),
    "h1": ParagraphStyle(
        "h1",
        fontName="Helvetica-Bold",
        fontSize=22,
        leading=26,
        textColor=STINE_GREEN_DARK,
        spaceBefore=10,
        spaceAfter=10,
    ),
    "h2": ParagraphStyle(
        "h2",
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=19,
        textColor=STINE_GREEN_DARK,
        spaceBefore=16,
        spaceAfter=6,
    ),
    "h3": ParagraphStyle(
        "h3",
        fontName="Helvetica-Bold",
        fontSize=11.5,
        leading=15,
        textColor=STINE_ORANGE,
        spaceBefore=10,
        spaceAfter=2,
    ),
    "body": ParagraphStyle(
        "body",
        fontName="Helvetica",
        fontSize=10.5,
        leading=15,
        textColor=INK,
        alignment=TA_LEFT,
        spaceAfter=4,
    ),
    "bullet": ParagraphStyle(
        "bullet",
        fontName="Helvetica",
        fontSize=10.5,
        leading=15,
        textColor=INK,
        leftIndent=22,
        firstLineIndent=-14,
        spaceAfter=2,
    ),
    "numbered": ParagraphStyle(
        "numbered",
        fontName="Helvetica",
        fontSize=10.5,
        leading=15,
        textColor=INK,
        leftIndent=22,
        firstLineIndent=-22,
        spaceAfter=2,
    ),
    "callout": ParagraphStyle(
        "callout",
        fontName="Helvetica",
        fontSize=11,
        leading=16,
        textColor=INK,
        alignment=TA_CENTER,
    ),
}


# ---------- cover ----------

def build_cover():
    out = []
    out.append(Spacer(1, 1.0 * inch))
    lw, lh = _logo_dims(3.4 * inch)
    img = Image(str(LOGO), width=lw, height=lh)
    img.hAlign = "CENTER"
    out.append(img)
    out.append(Spacer(1, 0.5 * inch))
    out.append(Paragraph("Project Manager", styles["title"]))
    out.append(Spacer(1, 0.05 * inch))
    out.append(Paragraph("User Tutorial", styles["subtitle"]))
    out.append(Spacer(1, 0.25 * inch))

    # accent rule
    out.append(HRFlowable(width=1.6 * inch, thickness=2.2, color=STINE_ORANGE, hAlign="CENTER"))
    out.append(Spacer(1, 0.25 * inch))

    tagline = (
        "A walkthrough of the app, page by page — with the cool stuff called out "
        "and the project management tools each idea was pulled from."
    )
    out.append(Paragraph(tagline, styles["tagline"]))
    out.append(Spacer(1, 0.35 * inch))

    # inspirations callout
    inspirations = (
        "Inspired by <b>Wrike</b> · <b>ClickUp</b> · <b>Microsoft Planner</b> · "
        "<b>Trello</b> · <b>Asana</b> · <b>Smartsheet</b> · <b>Jira</b> · "
        "<b>GanttPRO</b> · <b>Todoist</b>"
    )
    box = Table(
        [[Paragraph(inspirations, styles["callout"])]],
        colWidths=[5.2 * inch],
    )
    box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), STINE_GREEN_SOFT),
                ("BOX", (0, 0), (-1, -1), 0.75, STINE_GREEN),
                ("LINEBEFORE", (0, 0), (0, 0), 3, STINE_ORANGE),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )
    out.append(box)
    out.append(PageBreak())
    return out


# ---------- body ----------

def _section_header(title: str):
    """A nicer h2 with a green accent block on the left."""
    cell = Paragraph(title, styles["h2"])
    t = Table([[cell]], colWidths=[6.5 * inch])
    t.setStyle(
        TableStyle(
            [
                ("LINEBEFORE", (0, 0), (0, 0), 4, STINE_GREEN),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ]
        )
    )
    return KeepTogether([Spacer(1, 0.1 * inch), t, HRFlowable(width="100%", thickness=0.4, color=colors.HexColor("#e5e7eb"), spaceBefore=2, spaceAfter=6)])


def build_body():
    out = []
    lines = SRC.read_text(encoding="utf-8").splitlines()

    # skip the markdown header + intro paragraphs (they're on the cover)
    # find first "## " section
    start = 0
    for i, l in enumerate(lines):
        if l.startswith("## "):
            start = i
            break
    lines = lines[start:]

    i = 0
    bullets: list[str] = []
    table_rows: list[list[str]] = []

    def flush_bullets():
        nonlocal bullets
        if not bullets:
            return
        for b in bullets:
            out.append(
                Paragraph(
                    f'<font color="#1a9d37">●</font>&nbsp;&nbsp;{inline(b)}',
                    styles["bullet"],
                )
            )
        bullets = []

    def flush_table():
        nonlocal table_rows
        if not table_rows:
            return
        header_style = ParagraphStyle(
            "th",
            parent=styles["body"],
            textColor=colors.white,
            fontName="Helvetica-Bold",
            fontSize=11,
        )
        wrapped = [
            [
                Paragraph(inline(c), header_style if r == 0 else styles["body"])
                for c in row
            ]
            for r, row in enumerate(table_rows)
        ]
        tbl = Table(wrapped, colWidths=[2.6 * inch, 3.9 * inch], repeatRows=1)
        style = [
            ("BACKGROUND", (0, 0), (-1, 0), STINE_GREEN),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("LINEBELOW", (0, 0), (-1, 0), 1.5, STINE_ORANGE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")),
        ]
        for r in range(1, len(wrapped)):
            if r % 2 == 1:
                style.append(("BACKGROUND", (0, r), (-1, r), ZEBRA))
        tbl.setStyle(TableStyle(style))
        out.append(Spacer(1, 0.05 * inch))
        out.append(tbl)
        out.append(Spacer(1, 0.1 * inch))
        table_rows = []

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if stripped.startswith("|") and stripped.endswith("|"):
            cells = [c.strip() for c in stripped.strip("|").split("|")]
            if all(set(c) <= set("-: ") for c in cells):
                i += 1
                continue
            flush_bullets()
            table_rows.append(cells)
            i += 1
            continue
        else:
            flush_table()

        if stripped.startswith("### "):
            flush_bullets()
            out.append(Paragraph(inline(stripped[4:]), styles["h3"]))
        elif stripped.startswith("## "):
            flush_bullets()
            out.append(_section_header(inline(stripped[3:])))
        elif stripped.startswith("# "):
            flush_bullets()
            out.append(Paragraph(inline(stripped[2:]), styles["h1"]))
        elif stripped == "---":
            flush_bullets()
            out.append(Spacer(1, 0.1 * inch))
        elif stripped.startswith("- "):
            buf = [stripped[2:]]
            # absorb wrapped continuation lines (indented, non-empty, non-bullet)
            while i + 1 < len(lines):
                nxt = lines[i + 1]
                if nxt.startswith("  ") and nxt.strip() and not nxt.lstrip().startswith(("-", "#", "|")):
                    i += 1
                    buf.append(nxt.strip())
                else:
                    break
            bullets.append(" ".join(buf))
        elif re.match(r"^\d+\.\s", stripped):
            flush_bullets()
            m = re.match(r"^(\d+)\.\s(.*)", stripped)
            num, rest = m.group(1), m.group(2)
            buf = [rest]
            while i + 1 < len(lines):
                nxt = lines[i + 1]
                if nxt.startswith("   ") and nxt.strip():
                    i += 1
                    buf.append(nxt.strip())
                else:
                    break
            out.append(
                Paragraph(
                    f'<font color="#d94e27"><b>{num}.</b></font>&nbsp;&nbsp;{inline(" ".join(buf))}',
                    styles["numbered"],
                )
            )
        elif stripped == "":
            flush_bullets()
            out.append(Spacer(1, 0.06 * inch))
        else:
            flush_bullets()
            buf = [stripped]
            while (
                i + 1 < len(lines)
                and lines[i + 1].strip()
                and not lines[i + 1].lstrip().startswith(("-", "#", "|"))
                and not re.match(r"^\d+\.\s", lines[i + 1].lstrip())
                and lines[i + 1].strip() != "---"
            ):
                i += 1
                buf.append(lines[i].strip())
            out.append(Paragraph(inline(" ".join(buf)), styles["body"]))
        i += 1

    flush_bullets()
    flush_table()
    return out


# ---------- doc ----------

def build():
    doc = BaseDocTemplate(
        str(OUT),
        pagesize=LETTER,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        title="Project Manager — User Tutorial",
        author="Stine",
    )

    cover_frame = Frame(
        0.75 * inch,
        0.75 * inch,
        PAGE_W - 1.5 * inch,
        PAGE_H - 1.5 * inch,
        id="cover",
        showBoundary=0,
    )
    content_frame = Frame(
        0.75 * inch,
        0.7 * inch,
        PAGE_W - 1.5 * inch,
        PAGE_H - 1.8 * inch,
        id="content",
        showBoundary=0,
    )

    doc.addPageTemplates(
        [
            PageTemplate(id="cover", frames=[cover_frame], onPage=draw_cover_background),
            PageTemplate(id="content", frames=[content_frame], onPage=draw_content_chrome),
        ]
    )

    story = build_cover()
    # switch to content template starting on next page
    from reportlab.platypus.doctemplate import NextPageTemplate

    story.insert(len(story) - 1, NextPageTemplate("content"))
    story.extend(build_body())

    doc.build(story)
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    build()
