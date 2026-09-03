# Marketing background

Reference material for producing marketing, promotional and sales material, and for planning the
launch of the new version — so that work starts from an accurate picture of both products without
re-reading the codebase or the old help system each time.

**Sources of record.** Everything here is derived from two places and nothing else:

| File | Derived from |
|---|---|
| [old-system.md](old-system.md) | `old-system/help/` — the complete help guide for ItsPlainSailing 4.0, the PHP product now live at itsplainsailing.com |
| [new-system.md](new-system.md) | This repository — `.claude/modules/*.md`, `docs/`, `PRODUCT.md`, and the code where those were not enough |
| [what-changed.md](what-changed.md) | Both of the above, compared |
| [messaging.md](messaging.md) | The two above plus `PRODUCT.md` and `DESIGN.md` |
| [facts.md](facts.md) | Measured from the repository on the date each figure is stamped |

Finished work lives in **[`marketing/`](../../marketing/)** at the repository root, not here. This
folder is background; that folder is output.

---

## The rule that matters most

**Nothing may be invented.** `PRODUCT.md` is explicit that this repository holds
no pricing, no plan structure, no customer names, no testimonials, no adoption figures and no case
studies. A brochure that fills those gaps with plausible-sounding numbers is worse than one that
leaves them out, because the first person to check will be a prospect.

Where a claim needs a figure the repository does not have, **leave a marked placeholder** — the
convention is `[[NEEDS: …]]` — and list it in the deliverable's own "what this needs before it
ships" section. [facts.md](facts.md) keeps the running list of what is known and what is not.

Two further limits worth stating before they are crossed:

- **The old system is our own product, not a competitor.** The comparison is an upgrade story told
  to people who already trust us. Copy that rubbishes version 4 rubbishes the clubs still running
  on it and the decision they made to buy it.
- **Gaps are commercial information, not embarrassment.** [what-changed.md](what-changed.md) §3
  lists what version 4 does that the new system does not do yet. A club that depends on one of
  those will find out during their first month; better it shapes the pitch than the churn.

---

## Keeping this current

These files describe a product that changes every week, so treat them the way CLAUDE.md §3.6 treats
the module summaries: **a stale summary is worse than none, because it gets trusted without being
checked.**

Update them in the same pass as the work, whenever a change:

- adds, removes or renames a **capability**, a module, or a page a club would recognise by name;
- changes what the product **claims** — a limit lifted, a workflow removed, a new integration;
- closes one of the gaps in [what-changed.md](what-changed.md) §3, or opens a new one;
- changes a **figure** in [facts.md](facts.md) — locale count, module count, anything cited.

A change that only refactors, fixes a defect nobody outside would notice, or adds tests needs no
update here. The test is: *would a slide have to change?*

When something in `marketing/` has already been produced against a fact that has since moved, say so
in the update rather than silently correcting only the background file — the deliverable is what a
prospect sees.
