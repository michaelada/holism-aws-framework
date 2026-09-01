# Account User Keycloak Theme

Keycloak login theme for the account-user application (`packages/account-shell`, "ItsPlainSailing").

## What it is matched to

The member crosses from the organisation gateway (screen A2) to this page mid-task and back a moment
later, so the theme is deliberately **the account application's own design system**, not a separate
look:

| | Value | Source |
|---|---|---|
| Primary | `#1976d2` | `palette.primary.main` in `packages/account-shell/src/theme/index.ts` |
| Body text | Roboto, `rgba(0,0,0,0.87)` | `typography.fontFamily` |
| Headings | Sora, 600 | `typography.h1` / `h2` |
| Card | white, 4px radius, MUI elevation-1 shadow, 600px max | `Paper` inside `Container maxWidth="sm"` — `OrganisationGatewayPage.tsx` |
| Buttons | contained primary, **not** uppercase | `MuiButton.styleOverrides.textTransform: 'none'` |

**These values are duplicated by necessity.** MUI's theme cannot reach a FreeMarker template, so they
are transcribed in `login/resources/css/account.css`. If the app's theme changes, this file has to
change with it; every value there is labelled with where it came from.

**Per-organisation branding is not applied here.** The gateway is branded with each club's own
`primaryColor`, but Keycloak has no idea which club the member came from — the authorization request
carries no organisation. The theme therefore uses the platform default, which is also what most
clubs use. Making this per-club needs the organisation passed into the auth request and read by the
theme; it is not implemented.

## Stylesheets

`login/theme.properties` lists exactly one of:

- `css/account.css` — **current**. Matches the account application, as above.
- `css/neumorphic.css` — the previous treatment: grey `#e8e8e8` ground, embossed shadows, teal
  `#009087`. That palette came from the **org-admin** design system, so it matched a different
  application than the one the member was actually using. Kept as the documented alternative — see
  [docs/KEYCLOAK_THEME_SWITCHING.md](../../../docs/KEYCLOAK_THEME_SWITCHING.md).

## Copy

- **Title**: "ItsPlainSailing"
- **Login heading**: "Member Login" (`accountLoginHeading` in `messages_en.properties`)
- **Login description**: shown on the login page only

The heading comes from each page's own `header` section, and the description is opt-in via
`displayDescription`. Both used to be hard-coded in `template.ftl`, which meant a member creating an
account was told to "enter your email and password to access your account" above a registration form
that had no password to enter yet.

Only `login.ftl` is overridden. Registration, forgotten password and the rest come from the parent
`keycloak` theme and inherit this layout and CSS — which is why `account.css` styles **both** button
vocabularies, `.btn-primary` (ours) and `.pf-c-button.pf-m-primary` (PatternFly's, used by the
inherited pages).

## Applying it

The theme is set on the **`account-app` client**, not the realm, so the other front ends keep their
own. See [docs/ACCOUNT_APP_KEYCLOAK_SETUP.md](../../../docs/ACCOUNT_APP_KEYCLOAK_SETUP.md).

Themes are mounted into the container by `docker-compose.yml`
(`./infrastructure/keycloak/themes:/opt/keycloak/themes`) and Keycloak runs with `start-dev`, so
edits appear on reload with no restart.

## Naming the club

`login/resources/js/club.js` adds a line under the heading: *Signing in to Meath Hunt Pony Club*.

The club is read from `redirect_uri` on this page's own URL and its name fetched from
`/api/public/organisations/:code`. It is stashed in `sessionStorage` because a failed password
re-renders the form at a URL that no longer carries `redirect_uri`. Any failure leaves the line
hidden, and the name is written with `textContent`.

See `docs/KEYCLOAK_LOGIN_NAMES_THE_CLUB.md`.
