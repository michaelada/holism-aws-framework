# Account User Application — wireframe images

The SVGs in this directory are the diagrams in
[`../../ACCOUNT_USER_APP_WIREFRAMES.md`](../../ACCOUNT_USER_APP_WIREFRAMES.md). They are generated,
not hand-drawn — **edit the ASCII in [`src/`](src/), then rebuild**:

```bash
python3 scripts/wireframes/ascii_to_svg.py build --out docs/images/account-user
```

One `src/<name>.txt` produces one `<name>.svg`. The file name matches the screen it belongs to
(`E1-cart-desktop.txt` → screen E1), with a `-2` suffix where a screen has more than one diagram.

## Why SVG

- Vector, so it stays sharp at any zoom and in a PDF export.
- Theme-aware — each file carries a `prefers-color-scheme` block, so diagrams follow a dark IDE
  rather than glaring white.
- Diffable. A changed diagram shows up in review as a changed `.txt`, not an opaque binary blob.

## What the generator does

Beyond drawing boxes as real strokes, it repairs two things that make hand-drawn ASCII hard to read:

- **Alignment.** Vertical borders drift by a column between rule rows and content rows, so boxes
  stop closing. The generator finds the column each border was meant to sit on and nudges it there.
  Borders that appear on the same line are never merged — `│ │` is two panels, not one border that
  drifted.
- **Width.** Emoji occupy two columns in a terminal but one character in a file. Columns are
  measured by display width, so the diagrams line up the way they were authored.

Shade characters (`░▒▓█`) become filled cells, which is what makes the calendar availability grid
(D12) and the ticket QR placeholder (C10) readable.

## Adding a diagram

Write the ASCII in the Markdown as usual, then re-run the extractor:

```bash
python3 scripts/wireframes/ascii_to_svg.py extract \
    --markdown docs/ACCOUNT_USER_APP_WIREFRAMES.md \
    --out docs/images/account-user
```

It only converts fenced blocks that actually contain box drawing, so SQL, schema listings, route
tables and the fee formulas in Part 4 are left as code blocks.
