#!/usr/bin/env python3
"""
Build a Word document from a wireframe Markdown file.

The diagrams are SVG, which Word only renders reliably from 2016 onwards and
not at all in Google Docs or Pages, so they are rasterised to PNG at 2x first.
Each image is then given an explicit width in inches, because the docx writer
otherwise places images at their pixel size and the wide desktop wireframes run
off the page.

Requires pandoc and Google Chrome (used headless as the SVG rasteriser).

Usage:
    python3 scripts/wireframes/md_to_docx.py \
        --markdown docs/ACCOUNT_USER_APP_WIREFRAMES.md \
        --output docs/ACCOUNT_USER_APP_WIREFRAMES.docx
"""

from __future__ import annotations

import argparse
import re
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

CHROME = (
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
)
SCALE = 2                 # device pixel ratio for the raster
CSS_PPI = 96              # CSS pixels per inch

# A4 portrait with 0.5in margins gives a 7.27in column. The widest wireframe is
# 7.89in, so exactly one diagram shrinks, to 92% — its text lands at 9pt, still
# comfortably readable. The alternatives are worse: Word's default Letter with
# 1in margins shrinks 32 of the 50, and landscape fits everything at full size
# but leaves prose running across a 10.7in line. Diagrams narrower than the
# column keep their natural size rather than being blown up.
PAGE_W_TWIPS = 11906      # A4 portrait
PAGE_H_TWIPS = 16838
MARGIN_TWIPS = 720        # 0.5in
MAX_WIDTH_IN = (PAGE_W_TWIPS - 2 * MARGIN_TWIPS) / 1440


SECT_PR = (
    "<w:sectPr>"
    f'<w:pgSz w:w="{PAGE_W_TWIPS}" w:h="{PAGE_H_TWIPS}"/>'
    f'<w:pgMar w:top="{MARGIN_TWIPS}" w:right="{MARGIN_TWIPS}" '
    f'w:bottom="{MARGIN_TWIPS}" w:left="{MARGIN_TWIPS}" '
    'w:header="708" w:footer="708" w:gutter="0"/>'
    "</w:sectPr>"
)


def make_reference_doc(dest: Path) -> Path:
    """
    Pandoc's stock reference document has no page size, so Word falls back to
    portrait Letter. Take that reference and set A4 landscape with narrow
    margins, leaving everything else (styles, fonts) alone.
    """
    import zipfile

    raw = subprocess.run(
        ["pandoc", "--print-default-data-file", "reference.docx"],
        check=True,
        capture_output=True,
    ).stdout
    stock = dest.parent / "stock-reference.docx"
    stock.write_bytes(raw)

    with zipfile.ZipFile(stock) as zin, \
            zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == "word/document.xml":
                xml = data.decode("utf-8")
                if "<w:sectPr" in xml:
                    xml = re.sub(r"<w:sectPr.*?</w:sectPr>", SECT_PR, xml, flags=re.S)
                else:
                    xml = xml.replace("</w:body>", SECT_PR + "</w:body>")
                data = xml.encode("utf-8")
            zout.writestr(item, data)
    return dest


def enable_field_update(docx: Path) -> None:
    """
    Ask Word to refresh fields when the document opens.

    Pandoc writes the table of contents as a TOC field with no cached result,
    so without this the contents page is blank until the reader knows to press
    F9. This has to be applied to the finished document rather than to the
    reference, because pandoc generates its own settings.xml.
    """
    import zipfile

    with zipfile.ZipFile(docx) as zin:
        items = [(i, zin.read(i.filename)) for i in zin.infolist()]

    with zipfile.ZipFile(docx, "w", zipfile.ZIP_DEFLATED) as zout:
        for item, data in items:
            if item.filename == "word/settings.xml":
                data = _enable_field_update(data.decode("utf-8")).encode("utf-8")
            zout.writestr(item, data)


def _enable_field_update(xml: str) -> str:
    """
    Ask Word to refresh fields when the document opens.

    Pandoc writes the table of contents as a TOC field with no cached result,
    so without this the contents page is blank until the reader knows to press
    F9. w:updateFields has a fixed position in the CT_Settings sequence, hence
    the anchored insert rather than appending before the closing tag.
    """
    if "<w:updateFields" in xml:
        return xml
    tag = '<w:updateFields w:val="true"/>'
    # Elements that follow updateFields in the CT_Settings sequence, earliest
    # first. Inserting before the first one present keeps the file valid; Word
    # reports an out-of-order settings.xml as a document needing repair.
    for anchor in (
        "<w:hdrShapeDefaults",
        "<w:footnotePr",
        "<w:endnotePr",
        "<w:compat",
        "<w:docVars",
        "<w:rsids",
        "<m:mathPr",
        "<w:themeFontLang",
        "<w:clrSchemeMapping",
        "<w:decimalSymbol",
        "<w:listSeparator",
    ):
        if anchor in xml:
            return xml.replace(anchor, tag + anchor, 1)
    return xml.replace("</w:settings>", tag + "</w:settings>")

# [ \t]* rather than \s* — in multiline mode \s* swallows the blank line after
# the image, which glues the following heading into the image's paragraph and
# silently loses it as a heading (and as a cross-reference target).
IMAGE_RE = re.compile(r"^!\[(?P<alt>[^\]]*)\]\((?P<src>[^)\s]+)\)[ \t]*$", re.M)


def svg_size(path: Path) -> tuple[float, float]:
    """Intrinsic size of an SVG, from its width/height or viewBox."""
    head = path.read_text(encoding="utf-8")[:600]
    w = re.search(r'\bwidth="([\d.]+)"', head)
    h = re.search(r'\bheight="([\d.]+)"', head)
    if w and h:
        return float(w.group(1)), float(h.group(1))
    vb = re.search(r'viewBox="[\d.\-]+ [\d.\-]+ ([\d.]+) ([\d.]+)"', head)
    if vb:
        return float(vb.group(1)), float(vb.group(2))
    raise ValueError(f"cannot determine size of {path}")


def png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as fh:
        head = fh.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"not a PNG: {path}")
    return struct.unpack(">II", head[16:24])


def rasterise(svg: Path, png: Path, work: Path) -> tuple[float, float]:
    """
    Render one SVG to PNG with no surrounding whitespace.

    Returns the SVG's own CSS size, which is what the image should be *placed*
    at. The PNG is deliberately larger: the source is vector, so drawing it at
    SCALE times its CSS size costs nothing and gives a sharp result in print.
    --force-device-scale-factor is not reliable in headless mode, so the
    oversampling is done by scaling the page instead.
    """
    w, h = svg_size(svg)
    # Chrome screenshots the viewport, so the page has to be exactly the size
    # of the image with no body margin, otherwise the PNG carries a white
    # border and an offset.
    rw, rh = round(w * SCALE), round(h * SCALE)
    wrapper = work / f"{svg.stem}.html"
    wrapper.write_text(
        "<!doctype html><meta charset='utf-8'>"
        "<style>html,body{margin:0;padding:0;background:#fff}"
        "img{display:block}</style>"
        f"<img src='{svg.resolve().as_uri()}' width='{rw}' height='{rh}'>",
        encoding="utf-8",
    )
    subprocess.run(
        [
            CHROME,
            "--headless",
            "--disable-gpu",
            "--hide-scrollbars",
            f"--screenshot={png}",
            f"--window-size={rw},{rh}",
            wrapper.resolve().as_uri(),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if not png.exists():
        raise RuntimeError(f"Chrome produced no output for {svg}")
    return w, h


def build(markdown: Path, output: Path) -> None:
    if shutil.which("pandoc") is None:
        sys.exit("pandoc is not installed")
    if not Path(CHROME).exists():
        sys.exit(f"Chrome not found at {CHROME}")

    doc_dir = markdown.parent
    text = markdown.read_text(encoding="utf-8")

    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        images = work / "img"
        images.mkdir()

        converted: dict[str, tuple[Path, float]] = {}

        def replace(m: re.Match[str]) -> str:
            src = m.group("src")
            alt = m.group("alt")
            svg = (doc_dir / src).resolve()
            if not svg.exists():
                print(f"  ! missing image, left as-is: {src}")
                return m.group(0)

            if src not in converted:
                png = images / (svg.stem + ".png")
                css_w, _ = rasterise(svg, png, work)
                px_w, _ = png_size(png)
                # Placement size comes from the SVG's CSS width, not the PNG's
                # pixel width — the PNG is oversampled, and sizing from it
                # would silently place every diagram at 1/SCALE of its
                # intended size and shrink the text with it.
                inches = min(MAX_WIDTH_IN, css_w / CSS_PPI)
                dpi = px_w / inches
                converted[src] = (png, inches)
                print(
                    f"  {svg.name} -> {inches:.2f}in "
                    f"({px_w}px raster, {dpi:.0f} dpi)"
                )

            png, inches = converted[src]
            # Pandoc's docx writer honours an explicit width attribute; without
            # one a 1100px-wide diagram lands on the page at 11 inches.
            return f'![{alt}]({png.as_posix()}){{ width={inches:.2f}in }}'

        print(f"rasterising diagrams from {markdown} …")
        body = IMAGE_RE.sub(replace, text)

        front = (
            "---\n"
            'title: "Account User Application"\n'
            'subtitle: "Proposed screens and wireframes"\n'
            'lang: en-GB\n'
            "---\n\n"
        )
        staged = work / "staged.md"
        staged.write_text(front + body, encoding="utf-8")

        reference = make_reference_doc(work / "reference.docx")

        output.parent.mkdir(parents=True, exist_ok=True)
        print(f"running pandoc → {output}")
        subprocess.run(
            [
                "pandoc",
                str(staged),
                "-o",
                str(output),
                "--reference-doc",
                str(reference),
                # gfm_auto_identifiers makes pandoc generate the same heading
                # ids GitHub does, so the document's many internal
                # cross-references still resolve as Word bookmarks.
                "-f",
                "markdown+gfm_auto_identifiers",
                "-t",
                "docx",
                "--toc",
                "--toc-depth=3",
                "--resource-path",
                f"{work}:{doc_dir}",
            ],
            check=True,
        )

    enable_field_update(output)

    size_mb = output.stat().st_size / (1024 * 1024)
    print(f"done: {output} ({size_mb:.1f} MB, {len(converted)} diagrams)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--markdown", required=True, type=Path)
    ap.add_argument("--output", required=True, type=Path)
    build(*vars(ap.parse_args()).values())


if __name__ == "__main__":
    main()
