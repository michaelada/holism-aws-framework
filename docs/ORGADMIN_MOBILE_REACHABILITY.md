# The page no longer scrolls sideways

DESIGN.md's *Reachable Not Optimised Rule*: on a phone an administrator may be slower, but must
never be blocked. They were blocked.

## Measured before

At a 390px viewport:

| Route | Document width | Overflow |
|---|---|---|
| `/orgadmin/members` | **1093px** | +703 |
| `/orgadmin/settings` | 877px | +487 |
| `/orgadmin/payments` | 693px | +303 |

"Add Member" — the primary action of the primary operational screen — sat **464px past the right
edge**, and nothing on screen suggested the page scrolled at all. At 1200px the members table's
Actions column, carrying View and Edit, was clipped with no affordance either.

## The cause was one CSS property

`main` is a flex child of the shell's row. A flex child's default `min-width: auto` refuses to
shrink below its content, so a 997px table did not overflow *itself* — it pushed the **document**
to 1093px and took every other element with it.

```ts
// packages/orgadmin-shell/src/components/Layout.tsx
minWidth: 0,
```

That single property moved the overflow inside the table, where it belongs and where a scrollbar
makes it visible. Members went 1093px → 479px on its own.

## Two remaining offenders

**Page header rows did not wrap.** `display: flex; justify-content: space-between` with a title on
one side and action buttons on the other has no wrap, so the buttons pushed out to 479px. The same
row appears in **37 files**, so `flexWrap: 'wrap'` and a gap were applied across all of them. Members
went 479px → 390px: zero overflow.

**The Actions column was still off-screen at desktop width.** With the table now scrolling in its own
container, Actions sat at 1293px against a container edge of 1152px — reachable only by scrolling
horizontally past nine other columns. It is now `position: sticky; right: 0`, so the rest of the row
scrolls underneath it. Verified: scrolling the table fully right leaves the column at 1152px.

## Measured after

| Route | 390px | 1200px |
|---|---|---|
| members | **390px, zero overflow**, "Add Member" reachable | Actions pinned, page overflow 0 |
| settings | 390px, zero overflow | — |
| payments | 390px, zero overflow | — |

No interactive element in `main` measures under 44×44 on any of the three.

## What this is not

This is not a phone-first redesign, and PRODUCT.md does not ask for one: org-admin is desktop-first,
and dense tables belong to the laptop. The tables still scroll horizontally on a phone rather than
becoming stacked cards. That is the difference between *reachable* and *optimised*, and only the
first was in scope.

Stacked-row cards below `md` remain the better answer for the operational screens, and DESIGN.md
already specifies them. The sticky Actions column was applied to the members table only; the same
treatment suits any table wide enough to clip.
