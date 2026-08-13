#!/usr/bin/env python3
"""
Render ASCII box-drawing wireframes as SVG.

Used to turn the ASCII diagrams in docs/*_WIREFRAMES.md into images that read
cleanly in an IDE, a browser and GitHub, without losing the ability to edit the
diagram afterwards.

Box-drawing characters become real vector strokes; shade characters become filled
rectangles; everything else is drawn as monospace text with an explicit advance
width so glyphs stay aligned with the strokes whatever font the viewer has.

Two modes:

  extract   Pull every wireframe code block out of a Markdown file into one
            .txt per diagram, then replace the block in the Markdown with an
            image reference. Run once.

  build     Re-render every .txt in the source directory to SVG. Run after
            editing a .txt.

Usage:
    python3 scripts/wireframes/ascii_to_svg.py extract \
        --markdown docs/ACCOUNT_USER_APP_WIREFRAMES.md \
        --out docs/images/account-user

    python3 scripts/wireframes/ascii_to_svg.py build \
        --out docs/images/account-user
"""

from __future__ import annotations

import argparse
import re
import sys
import unicodedata
from pathlib import Path

# ---------------------------------------------------------------------------
# Geometry. CHAR_W / LINE_H define the character cell; everything else derives
# from them, so changing the font size rescales the whole diagram.
# ---------------------------------------------------------------------------

FONT_SIZE = 13.0
CHAR_W = 7.8            # advance width of one column at FONT_SIZE
LINE_H = 17.0
PAD = 16.0
FONT_STACK = (
    "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, "
    "DejaVu Sans Mono, monospace"
)

# ---------------------------------------------------------------------------
# Character classification
# ---------------------------------------------------------------------------

# Which cell edges each box-drawing character connects to. Drawing every cell's
# stroke from its centre to the edges it connects means neighbouring cells meet
# exactly, so runs and junctions come out continuous without special-casing.
N, S, E, W = "N", "S", "E", "W"

BOX: dict[str, tuple[tuple[str, ...], bool]] = {
    # char: (directions, is_double)
    "─": ((E, W), False),
    "━": ((E, W), True),
    "│": ((N, S), False),
    "┃": ((N, S), True),
    "┌": ((S, E), False),
    "┐": ((S, W), False),
    "└": ((N, E), False),
    "┘": ((N, W), False),
    "├": ((N, S, E), False),
    "┤": ((N, S, W), False),
    "┬": ((E, W, S), False),
    "┴": ((E, W, N), False),
    "┼": ((N, S, E, W), False),
    "═": ((E, W), True),
    "║": ((N, S), True),
    "╔": ((S, E), True),
    "╗": ((S, W), True),
    "╚": ((N, E), True),
    "╝": ((N, W), True),
    "╠": ((N, S, E), True),
    "╣": ((N, S, W), True),
    "╦": ((E, W, S), True),
    "╩": ((E, W, N), True),
    "╬": ((N, S, E, W), True),
}

# Shade blocks become filled cells rather than glyphs — they are used for
# calendar availability and QR placeholders, where a glyph reads as noise.
SHADE = {"░": 0.13, "▒": 0.30, "▓": 0.52, "█": 0.78, "▰": 0.62, "▱": 0.15}

CORNERS = set("┌┐└┘╔╗╚╝")


def cell_width(ch: str) -> int:
    """Columns a character occupies, matching terminal rendering."""
    if unicodedata.east_asian_width(ch) in ("W", "F"):
        return 2
    if unicodedata.combining(ch):
        return 0
    return 1


def is_wide(ch: str) -> bool:
    return cell_width(ch) == 2


def looks_like_wireframe(text: str) -> bool:
    """True for diagram blocks, false for SQL, schema, formulas and route lists."""
    if any(c in text for c in CORNERS):
        return True
    return text.count("│") >= 3


# ---------------------------------------------------------------------------
# Grid construction
# ---------------------------------------------------------------------------


class Grid:
    """An ASCII diagram mapped onto a column/row grid by display width."""

    def __init__(self, lines: list[str]) -> None:
        self.rows: list[list[tuple[int, str]]] = []
        for line in lines:
            col = 0
            cells: list[tuple[int, str]] = []
            for ch in line:
                cells.append((col, ch))
                col += cell_width(ch)
            self.rows.append(cells)
        self.width = max((self._row_width(r) for r in self.rows), default = 0)
        self.height = len(self.rows)
        self._index: list[dict[int, str]] = [dict(r) for r in self.rows]

    @staticmethod
    def _row_width(row: list[tuple[int, str]]) -> int:
        if not row:
            return 0
        col, ch = row[-1]
        return col + cell_width(ch)

    def at(self, row: int, col: int) -> str:
        if 0 <= row < self.height:
            return self._index[row].get(col, " ")
        return " "


FILLER = (" ", "─", "═")


def _is_vertical(ch: str) -> bool:
    """True for characters that carry a vertical border: bars, corners, tees."""
    entry = BOX.get(ch)
    return bool(entry) and (N in entry[0] or S in entry[0])


def align(lines: list[str], tolerance: int = 1) -> list[str]:
    """
    Snap vertical borders onto shared columns.

    Hand-drawn diagrams drift: a rule row ends up a column narrower than the
    content rows around it, and the box stops closing. Rather than correcting
    fifty diagrams by hand, find the column each vertical border was *meant*
    to sit on and nudge it there by adjusting the run of spaces or rule
    characters immediately to its left.

    A diagram that is already consistent is returned unchanged.
    """
    # Which rows each column hosts a vertical border on.
    rows_at: dict[int, set[int]] = {}
    for r, line in enumerate(lines):
        col = 0
        for ch in line:
            if _is_vertical(ch):
                rows_at.setdefault(col, set()).add(r)
            col += cell_width(ch)

    # Cluster near-neighbour columns onto the most-used one. Two columns that
    # ever appear on the same row are different borders — "│ │" is two panels
    # side by side, not one border that drifted — so co-occurrence blocks the
    # merge. Without that guard a run of adjacent columns collapses into one.
    canonical: dict[int, int] = {}
    for col in sorted(rows_at, key=lambda c: (-len(rows_at[c]), c)):
        if col in canonical:
            continue
        canonical[col] = col
        claimed = set(rows_at[col])
        for other in sorted(rows_at, key=lambda c: abs(c - col)):
            if other in canonical or abs(other - col) > tolerance:
                continue
            if rows_at[other] & claimed:
                continue
            canonical[other] = col
            claimed |= rows_at[other]

    out: list[str] = []
    for line in lines:
        buf: list[str] = []
        width = 0          # display width emitted so far
        col = 0            # display column in the original line
        for ch in line:
            if _is_vertical(ch):
                target = canonical.get(col, col)
                delta = target - width
                if delta > 0:
                    filler = buf[-1] if buf and buf[-1] in ("─", "═") else " "
                    buf.append(filler * delta)
                    width += delta
                elif delta < 0:
                    # Reclaim columns from the filler run to the left, never
                    # from content.
                    need = -delta
                    while need and buf and buf[-1] and buf[-1][-1] in FILLER:
                        take = min(need, len(buf[-1]))
                        buf[-1] = buf[-1][:-take]
                        if not buf[-1]:
                            buf.pop()
                        need -= take
                        width -= take
            buf.append(ch)
            width += cell_width(ch)
            col += cell_width(ch)
        out.append("".join(buf))
    return out


def trim(lines: list[str]) -> list[str]:
    """Drop trailing whitespace and blank lines top and bottom."""
    lines = [ln.rstrip() for ln in lines]
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    return lines


# ---------------------------------------------------------------------------
# SVG emission
# ---------------------------------------------------------------------------

STYLE = """
  :root {
    --wf-bg: #ffffff;
    --wf-panel: #fbfbfd;
    --wf-stroke: #7a8394;
    --wf-stroke-strong: #2f6feb;
    --wf-text: #1a1f2b;
    --wf-shade: #2f6feb;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --wf-bg: #14171d;
      --wf-panel: #1b1f27;
      --wf-stroke: #7d8798;
      --wf-text: #e4e8ef;
      --wf-stroke-strong: #6fa0ff;
      --wf-shade: #6fa0ff;
    }
  }
  .bg { fill: var(--wf-bg); }
  .ln { stroke: var(--wf-stroke); stroke-width: 1.15; }
  .ln.dbl { stroke: var(--wf-stroke-strong); stroke-width: 1.9; }
  .tx {
    fill: var(--wf-text);
    font-size: %(fs).1fpx;
    font-family: %(font)s;
    white-space: pre;
    dominant-baseline: middle;
  }
  .sh { fill: var(--wf-shade); }
"""


def esc(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def render(lines: list[str], title: str) -> str:
    lines = align(trim(lines))
    grid = Grid(lines)

    w = grid.width * CHAR_W + PAD * 2
    h = grid.height * LINE_H + PAD * 2

    def x_of(col: int) -> float:
        return PAD + col * CHAR_W

    def y_of(row: int) -> float:
        return PAD + row * LINE_H

    # Connectivity per cell, used to merge runs of box characters into a few
    # long path segments. Emitting one <line> per character cell produced
    # 150 kB files; merging brings that down by better than an order of
    # magnitude with identical output.
    conn: dict[tuple[int, int], tuple[tuple[str, ...], bool]] = {}
    for r, row in enumerate(grid.rows):
        for col, ch in row:
            if ch in BOX:
                conn[(r, col)] = BOX[ch]

    def edge_double(a: tuple[int, int], b: tuple[int, int]) -> bool:
        return conn[a][1] and conn[b][1]

    # Maximal horizontal runs, per row.
    segments: list[tuple[float, float, float, float, bool]] = []
    for r, row in enumerate(grid.rows):
        cy = y_of(r) + LINE_H / 2
        cols = sorted(c for (rr, c) in conn if rr == r)
        i = 0
        while i < len(cols):
            c = cols[i]
            if E not in conn[(r, c)][0] or (r, c + 1) not in conn \
                    or W not in conn[(r, c + 1)][0]:
                i += 1
                continue
            start = c
            dbl = True
            while (r, c + 1) in conn and E in conn[(r, c)][0] \
                    and W in conn[(r, c + 1)][0]:
                dbl = dbl and edge_double((r, c), (r, c + 1))
                c += 1
            segments.append(
                (x_of(start) + CHAR_W / 2, cy, x_of(c) + CHAR_W / 2, cy, dbl)
            )
            i = cols.index(c) + 1 if c in cols else i + 1

    # Maximal vertical runs, per column.
    for col in sorted({c for (_, c) in conn}):
        rows_here = sorted(r for (r, c) in conn if c == col)
        i = 0
        while i < len(rows_here):
            r = rows_here[i]
            if S not in conn[(r, col)][0] or (r + 1, col) not in conn \
                    or N not in conn[(r + 1, col)][0]:
                i += 1
                continue
            start = r
            dbl = True
            while (r + 1, col) in conn and S in conn[(r, col)][0] \
                    and N in conn[(r + 1, col)][0]:
                dbl = dbl and edge_double((r, col), (r + 1, col))
                r += 1
            cx = x_of(col) + CHAR_W / 2
            segments.append(
                (cx, y_of(start) + LINE_H / 2, cx, y_of(r) + LINE_H / 2, dbl)
            )
            i = rows_here.index(r) + 1 if r in rows_here else i + 1

    plain = " ".join(
        f"M{x1:.1f} {y1:.1f}L{x2:.1f} {y2:.1f}"
        for x1, y1, x2, y2, d in segments if not d
    )
    strong = " ".join(
        f"M{x1:.1f} {y1:.1f}L{x2:.1f} {y2:.1f}"
        for x1, y1, x2, y2, d in segments if d
    )
    strokes = []
    if plain:
        strokes.append(f'<path class="ln" fill="none" d="{plain}"/>')
    if strong:
        strokes.append(f'<path class="ln dbl" fill="none" d="{strong}"/>')

    shades: list[str] = []
    texts: list[str] = []

    for r, row in enumerate(grid.rows):
        cy = y_of(r) + LINE_H / 2
        run: list[str] = []
        run_col = 0
        shade_start: int | None = None
        shade_op = 0.0
        shade_cols = 0

        def flush() -> None:
            nonlocal run, run_col
            if not run:
                return
            body = "".join(run)
            if body.strip():
                cols = sum(cell_width(c) for c in body)
                texts.append(
                    f'<text class="tx" x="{x_of(run_col):.2f}" y="{cy:.2f}" '
                    f'textLength="{cols * CHAR_W:.2f}" '
                    f'lengthAdjust="spacingAndGlyphs">{esc(body)}</text>'
                )
            run = []

        def flush_shade() -> None:
            nonlocal shade_start, shade_cols, shade_op
            if shade_start is None:
                return
            shades.append(
                f'<rect class="sh" x="{x_of(shade_start):.1f}" '
                f'y="{y_of(r) + 1:.1f}" '
                f'width="{CHAR_W * shade_cols:.1f}" '
                f'height="{LINE_H - 2:.1f}" opacity="{shade_op:.2f}"/>'
            )
            shade_start = None
            shade_cols = 0

        for col, ch in row:
            if ch in SHADE:
                flush()
                op = SHADE[ch]
                if shade_start is not None and op == shade_op \
                        and shade_start + shade_cols == col:
                    shade_cols += cell_width(ch)
                else:
                    flush_shade()
                    shade_start, shade_op = col, op
                    shade_cols = cell_width(ch)
                continue
            flush_shade()

            if ch in BOX:
                flush()
            elif is_wide(ch):
                # Emoji and other wide glyphs are placed without textLength so
                # the viewer's font is free to use its natural advance width.
                flush()
                texts.append(
                    f'<text class="tx" x="{x_of(col):.2f}" y="{cy:.2f}">'
                    f"{esc(ch)}</text>"
                )
            else:
                if not run:
                    run_col = col
                run.append(ch)
        flush()
        flush_shade()

    style = STYLE % {"fs": FONT_SIZE, "font": FONT_STACK}
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:.0f}" '
        f'height="{h:.0f}" viewBox="0 0 {w:.2f} {h:.2f}" role="img" '
        f'aria-label="{esc(title)}">',
        f"<title>{esc(title)}</title>",
        f"<style>{style}</style>",
        f'<rect class="bg" x="0" y="0" width="{w:.2f}" height="{h:.2f}" rx="6"/>',
        *shades,
        *strokes,
        *texts,
        "</svg>",
    ]
    return "\n".join(parts) + "\n"


# ---------------------------------------------------------------------------
# Markdown extraction
# ---------------------------------------------------------------------------

# Matches "### A1 — Title" and also "### C6 / C7 — Title", which covers two
# screens documented together.
HEADING = re.compile(
    r"^#{2,4}\s+(?:([A-Z]\d{1,2}(?:\s*/\s*[A-Z]\d{1,2})*)\s+—\s+)?(.+?)\s*$"
)
FENCE = re.compile(r"^```")


def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-") or "diagram"


def extract(markdown: Path, out_dir: Path) -> int:
    src_dir = out_dir / "src"
    src_dir.mkdir(parents=True, exist_ok=True)

    lines = markdown.read_text(encoding="utf-8").split("\n")
    result: list[str] = []
    seen: dict[str, int] = {}
    count = 0

    heading_id = ""
    heading_title = ""

    i = 0
    while i < len(lines):
        line = lines[i]

        m = HEADING.match(line)
        if m and not line.startswith("#####"):
            ident, title = m.group(1), m.group(2)
            if ident:
                heading_id, heading_title = ident, title
            else:
                # A section heading such as "## C. My activity" resets context.
                heading_id, heading_title = "", title
            result.append(line)
            i += 1
            continue

        if FENCE.match(line):
            block: list[str] = []
            j = i + 1
            while j < len(lines) and not FENCE.match(lines[j]):
                block.append(lines[j])
                j += 1
            body = "\n".join(block)

            if looks_like_wireframe(body):
                ident_slug = re.sub(r"\s*/\s*", "-", heading_id)
                base = f"{ident_slug}-{slugify(heading_title)}" if heading_id \
                    else slugify(heading_title)
                seen[base] = seen.get(base, 0) + 1
                if seen[base] > 1:
                    name = f"{base}-{seen[base]}"
                else:
                    name = base

                (src_dir / f"{name}.txt").write_text(body + "\n", encoding="utf-8")
                label = f"{heading_id} — {heading_title}" if heading_id \
                    else heading_title
                svg_name = f"{name}.svg"
                (out_dir / svg_name).write_text(
                    render(block, label), encoding="utf-8"
                )
                rel = f"{out_dir.name}/{svg_name}"
                if out_dir.parent.name == "images":
                    rel = f"images/{out_dir.name}/{svg_name}"
                result.append(f"![{label}]({rel})")
                count += 1
                i = j + 1
                continue

            # Not a diagram — copy the fenced block through untouched.
            result.extend(lines[i : j + 1])
            i = j + 1
            continue

        result.append(line)
        i += 1

    markdown.write_text("\n".join(result), encoding="utf-8")
    return count


def build(out_dir: Path) -> int:
    src_dir = out_dir / "src"
    if not src_dir.is_dir():
        sys.exit(f"no source directory at {src_dir}")
    count = 0
    for txt in sorted(src_dir.glob("*.txt")):
        lines = txt.read_text(encoding="utf-8").split("\n")
        (out_dir / f"{txt.stem}.svg").write_text(
            render(lines, txt.stem), encoding="utf-8"
        )
        count += 1
    return count


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)

    ex = sub.add_parser("extract", help="pull diagrams out of a Markdown file")
    ex.add_argument("--markdown", required=True, type=Path)
    ex.add_argument("--out", required=True, type=Path)

    bd = sub.add_parser("build", help="re-render .txt sources to SVG")
    bd.add_argument("--out", required=True, type=Path)

    args = ap.parse_args()
    if args.cmd == "extract":
        n = extract(args.markdown, args.out)
        print(f"extracted and rendered {n} diagrams to {args.out}")
    else:
        n = build(args.out)
        print(f"rendered {n} diagrams to {args.out}")


if __name__ == "__main__":
    main()
