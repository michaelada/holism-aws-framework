# Marketing

Everything for promoting and launching the new version of Its Plain Sailing: positioning and
messaging, promotional material, launch plans and strategy, and the collateral a salesperson
carries. Finished work lives here; the background it is written from lives in
[`.claude/marketing/`](../.claude/marketing/).

Nothing is here yet — this folder was created ready for the work.

---

## How a piece gets made

1. **Read the background first.** [`.claude/marketing/`](../.claude/marketing/) holds a description
   of the old product, the new one, the difference between them, the messaging rules and the
   citable facts. It exists so that work starts from something accurate rather than from a fresh
   reading of the codebase each time.
2. **Check the gap list.** [`what-changed.md`](../.claude/marketing/what-changed.md) §3 lists what
   version 4 does that the new system does not do yet. Nothing on that list may be promised.
3. **Mark what is missing rather than inventing it.** The convention is `[[NEEDS: …]]` in the text,
   plus a short section at the end of the piece listing what it needs before it ships.

## The three rules

**Nothing is invented.** This repository holds no pricing, no plan structure, no customer names, no
testimonials, no adoption figures and no case studies. A brochure that fills those in with
plausible-sounding numbers is worse than one that leaves them out, because the first person to check
is a prospect.

**The old system is ours, not a competitor.** The comparison is an upgrade story told to people who
already trust us. Copy that rubbishes version 4 rubbishes the clubs still running on it.

**The name means "it's easy", not "sailing."** No nautical metaphors, anywhere, ever — the product
is for clubs of every kind, and a compass on the cover tells a tennis club it is not for them. The
stylised sail mark is the single exception.

## Suggested shape as this fills up

```
marketing/
  positioning/     the four claims, the elevator version, the one-pager
  product/         feature sheets, module one-pagers, comparison tables
  launch/          the plan, the phasing, announcement copy, email sequences, social
  migration/       for clubs already on version 4
  sales/           decks, battlecards, objection handling, pricing once it exists
  assets/          diagrams and images produced for the above
```

**Plans and strategy belong here as much as collateral does.** A launch plan is the thing most of
the collateral is downstream of, and keeping it beside the material it produces is the point of
having one folder rather than two.

Nothing above is fixed. Move it around as the work arrives.
