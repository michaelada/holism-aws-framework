# The member edit page was headed by its own i18n key

## The report

> When I click the edit button for a member in the database, the heading shows
> "memberships.actions.editMember" at the top.

## What it was

`memberships.actions.editMember` was never written. `EditMemberPage` asks for it three times — once
for each of the page's states, loading, failed and loaded — so the heading read as the key in all
three, in every locale. Its neighbours were all there: `addMember`, `saveChanges`, `add`, and the
rest of `memberships.actions`.

Added to all six catalogues:

| Locale | |
|---|---|
| en-GB | Edit Member |
| de-DE | Mitglied bearbeiten |
| es-ES | Editar socio |
| fr-FR | Modifier le membre |
| it-IT | Modifica iscritto |
| pt-PT | Editar sócio |

## Why no test caught it

This module's suites mock `t()` as the identity function — deliberately, and documented in
`test/shell-mock.ts`: it makes assertions read as the key rather than as English, which is how most
of the package is written. It also makes them blind to exactly this. A page asking for a key nobody
wrote renders the key itself, the assertions still pass, and the club reads
`memberships.actions.editMember` across the top of the member they just opened.

`EditMemberPage.test.tsx` had covered the heading and would have gone on passing with the key
missing or present.

## The guard

`src/__tests__/i18n-key-coverage.test.ts` reads the module's **own sources** — not a list of keys
kept by hand, which stops covering a page the moment somebody adds a string to it — and checks every
`t('…')` with no fallback against the real catalogue:

- **en-GB must resolve every key**, and a failure names the key and the file that asks for it.
- **The other five are checked for contradiction, not coverage.** es-ES and fr-FR are partial by
  design and fall back to en-GB; what is refused there is a key present but not a string, which means
  a branch left half-written.
- `t('key', 'A default')` is excluded on purpose: a fallback puts a real string on the screen, so a
  missing key there is untranslated rather than raw.

Confirmed by removing the new key again — the suite fails with
`memberships.actions.editMember (pages/EditMemberPage.tsx, …)` — and restoring it.

## Elsewhere

The same scan across the other org-admin packages found two more, both left as they are for now
because they were not part of this report:

- `common.enabled` — visible text on the merchandise type details page (the catalogue has
  `common.messages.*`, not `common.enabled`);
- `common.loading` — used as a spinner's `aria-label` in `LodgementsPage`, `LodgementDetailPage`,
  `OfflinePaymentsPage` and `CreateMerchandiseTypePage`; the key is `common.messages.loading`.

Sighted, not fixed.
