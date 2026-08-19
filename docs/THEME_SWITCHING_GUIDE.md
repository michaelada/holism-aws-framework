# Theme switching (removed)

**There is no application theme switching, and there is no longer a second theme to switch to.**
Removed 18 August 2026. This file remains because four other documents link to it; what it used to
describe no longer exists.

## What was here

A guide to swapping each front end between two complete MUI themes — a teal-and-grey *neumorphic*
theme and the orange-and-gold *warm* theme — by editing which export in `src/theme/index.ts` was
aliased to `defaultTheme`, with the other left commented out one line above.

## Why it went

It was never a feature. Nothing read a preference, no user could reach it, and no environment
selected it. It was two designs kept in the tree at once, with a comment inviting the next person to
flip between them.

The cost was not the dead code. It was that the product's visual system looked like an open
question. `packages/admin` had already removed its copy; `packages/orgadmin-shell` exported a
neumorphic theme that nothing imported; and `packages/frontend` still *rendered* the neumorphic one,
which made the metadata repository the only surface in the platform that did not look like the
product.

## What is true now

Each front end exports exactly one theme:

| Package | Theme |
|---|---|
| `packages/orgadmin-shell` | `warmTheme` |
| `packages/admin` | `warmTheme` |
| `packages/frontend` | `warmTheme` |
| `packages/account-shell` | its own, built per club from the organisation's primary colour |

`account-shell` is deliberately different: a member sees their club's identity, not the platform's,
so its theme is constructed at runtime from the organisation's branding rather than fixed.

The warm theme is recorded as a settled brand commitment in [PRODUCT.md](../PRODUCT.md). It is not a
default awaiting an alternative.

## If you want to change how the product looks

Change `warmTheme`, or replace it — but replace it everywhere, and update the brand commitment. Do
not reintroduce a second theme and a switch. See [WARM_THEME_IMPLEMENTATION.md](WARM_THEME_IMPLEMENTATION.md)
for what the warm theme is, and [NEUMORPHIC_THEME.md](NEUMORPHIC_THEME.md) for the record of what was
removed.

**Keycloak login themes are a separate mechanism and still switch per client** — four bespoke login
themes are selected by `login_theme` on each Keycloak client. Nothing here affects them; see
[KEYCLOAK_THEME_SWITCHING.md](KEYCLOAK_THEME_SWITCHING.md).

## Files removed

- `packages/orgadmin-shell/src/theme/neumorphicTheme.ts` (248 lines, imported by nothing)
- `packages/frontend/src/theme/neumorphicTheme.ts` (rendered by `App.tsx` until this change)

`packages/frontend` gained `src/theme/warmTheme.ts`, copied from `packages/admin`, matching the
pattern the other front ends already use. That makes three near-identical copies of one theme — the
standing argument for moving it into `packages/components`, which this change deliberately did not
attempt.
