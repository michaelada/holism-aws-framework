# "Coming up" sat 16px right of everything under it

## The report

> On the account home page the "Coming up" card does not left-align properly with the other section
> rows underneath.

Measured in the browser, at 1512px wide:

| | Left edge |
|---|---|
| Coming up card | **328** |
| Upcoming events cards | 312 |
| Memberships card | 312 |
| Shop cards | 312 |

Sixteen pixels, which is `spacing={2}`.

## The cause

A spaced MUI `Grid container` does not add space — it *removes* it and gives it back. The container
takes a negative margin and every item takes matching padding:

```
.MuiGrid-container  { margin-left: -16px; margin-top: -16px }
.MuiGrid-item       { padding-left: 16px }
```

The two cancel, and content lands where it should. Unless something takes the negative margin away.
`Stack` does exactly that to its direct children:

```
.MuiStack-root > :not(style):not(style) { margin: 0 }
```

Both rules were present on this one container, confirmed by reading the matched rules off the live
element — `margin: 0` from the Stack, and the `-16px` it overrode. The item kept its `padding-left`
with nothing left to take it back, so the card started 16px in.

Every other section on the page wraps its grid in a `Box`, so its container is a child of the `Box`
rather than of the `Stack` and keeps its negative margin. This one was written without the wrapper,
which is why it alone was out of line.

## The fix

Wrap the container in a `Box`, exactly as the sections below it already do. No spacing values were
changed — the alignment they describe was always correct, it was being cancelled.

Verified in the browser after the change: the card's left edge is 312, matching every other card and
heading. At 390px wide both edges match too — 16 and 374 — so the mobile single-column layout is
unaffected.

## The test

jsdom computes no layout, so a pixel assertion would prove nothing. The two tests assert the
structure that caused it instead: no `Grid container` on the page is a direct child of a
`MuiStack-root`, and this one's parent is a `Box`. Both fail against the unfixed component and pass
against the fixed one — checked by reverting it.

**The general rule, which is the part worth keeping:** a spaced `Grid container` must never be a
direct child of a `Stack`. The first test states it for the whole page rather than for this card, so
the next section added this way fails immediately.
