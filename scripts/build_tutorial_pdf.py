#!/usr/bin/env python3
"""Build TUTORIAL.pdf from TUTORIAL.md with the Stine logo on the cover page.

Usage: python3 scripts/build_tutorial_pdf.py
"""

from __future__ import annotations

import re
from pathlib import Path

from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.lib import colors

ROOT = Path(__file__).resolve().parent.parent
LOGO = ROOT / "assets" / "stine-logo.jpeg"
SRC = ROOT / "TUTORIAL.md"
OUT = ROOT / "TUTORIAL.pdf"


def inline(text: str) -> str:
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r"`([^`]+)`", r'<font face="Courier">\1</font>', text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"\*([^*]+)\*", r"<i>\1</i>", text)
    return text


def build():
    styles = getSampleStyleSheet()
    body = ParagraphStyle(
        "body", parent=styles["BodyText"], fontSize=10.5, leading=14, alignment=TA_LEFT
    )
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontSize=18, spaceBefore=14, spaceAfter=8)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=14, spaceBefore=12, spaceAfter=6)
    h3 = ParagraphStyle("h3", parent=styles["Heading3"], fontSize=12, spaceBefore=8, spaceAfter=4)

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=LETTER,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        title="Project Manager — User Tutorial",
    )

    story = []

    if LOGO.exists():
        logo = Image(str(LOGO))
        max_w = 3.5 * inch
        ratio = logo.imageHeight / logo.imageWidth
        logo.drawWidth = max_w
        logo.drawHeight = max_w * ratio
        logo.hAlign = "CENTER"
        story.append(Spacer(1, 0.25 * inch))
        story.append(logo)
        story.append(Spacer(1, 0.3 * inch))

    lines = SRC.read_text(encoding="utf-8").splitlines()
    i = 0
    bullets: list[str] = []
    table_rows: list[list[str]] = []

    def flush_bullets():
        nonlocal bullets
        if not bullets:
            return
        for b in bullets:
            story.append(Paragraph("• " + inline(b), body))
        bullets = []

    def flush_table():
        nonlocal table_rows
        if not table_rows:
            return
        wrapped = [[Paragraph(inline(c), body) for c in row] for row in table_rows]
        tbl = Table(wrapped, colWidths=[2.6 * inch, 3.6 * inch])
        tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2e7d32")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(tbl)
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
            story.append(Paragraph(inline(stripped[4:]), h3))
        elif stripped.startswith("## "):
            flush_bullets()
            story.append(Paragraph(inline(stripped[3:]), h2))
        elif stripped.startswith("# "):
            flush_bullets()
            story.append(Paragraph(inline(stripped[2:]), h1))
        elif stripped == "---":
            flush_bullets()
            story.append(Spacer(1, 0.15 * inch))
        elif stripped.startswith("- "):
            bullets.append(stripped[2:])
        elif re.match(r"^\d+\.\s", stripped):
            flush_bullets()
            story.append(Paragraph(inline(stripped), body))
        elif stripped == "":
            flush_bullets()
            story.append(Spacer(1, 0.08 * inch))
        else:
            flush_bullets()
            # join wrapped paragraph lines
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
            story.append(Paragraph(inline(" ".join(buf)), body))
        i += 1

    flush_bullets()
    flush_table()

    doc.build(story)
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    build()
