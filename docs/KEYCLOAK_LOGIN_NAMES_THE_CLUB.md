# The sign-in page says which club you are signing in to

## The question

> On the Meath Hunt Pony Club page I click "Sign In" and it brings me to the page where I enter my
> email and password. Is it possible to show the name of the organisation I am logging into, or is
> that not possible because it is Keycloak?

Possible. A member leaves a page branded for one club and arrives at one headed "Account Login",
with nothing on it naming where they are — and somebody with accounts at two clubs cannot tell which
sign-in they are completing.

## How the club is known

Not from Keycloak's own model. All four clubs share the `account-app` client, so `${client.name}`
would say the same thing for every one of them, and Keycloak 26's Organizations feature (`kc_org`)
is the purpose-built answer to this — this is **Keycloak 23.0.7**.

It comes from the page's own URL. The account app sends `redirect_uri` back to the club it started
at:

```
…/protocol/openid-connect/auth?client_id=account-app
  &redirect_uri=http%3A%2F%2Flocalhost%3A5176%2Faccount%2Fmhpc
  &code_challenge=…
```

`club.js` reads `mhpc` out of it and asks `GET /api/public/organisations/mhpc` — anonymous, and
already what the organisation gateway itself uses — for the display name.

**The theme was already doing this kind of thing.** `posts.js` fetches `/api/public/posts` to draw
the announcements column, so the fetch, the API-base resolution and the failure discipline are all
established patterns rather than new machinery.

## The part that would have broken it

**A wrong password loses the parameter.** Keycloak re-renders the form at:

```
…/login-actions/authenticate?execution=…&client_id=account-app&tab_id=yanZW9YJwAc
```

with no `redirect_uri`. Verified in a browser before writing anything, not assumed. A script that
only read the URL would name the club on the first attempt and drop it the moment somebody mistyped
— which is the worst moment for a sign-in page to look unsure where it is.

So the code is stashed in `sessionStorage` on the first render. The page is served from Keycloak's
own origin, so it is still there for the retry, and it dies with the tab.

## Rules the script follows

The same two `posts.js` set out, for the same reasons:

- **It can never break the sign-in form.** Every path is inside a try/catch, and any failure — no
  code, no storage, no API, a 404, bad JSON — leaves the line hidden, which is exactly the page as
  it was before. Nobody reading this page has signed in, so nobody can report it broken.
- **The name goes in with `textContent`, never `innerHTML`.** It originates in a query parameter on
  a public URL and is therefore attacker-controllable. This is the one page where an injection would
  be worth mounting.

Two smaller decisions:

- **No fallback to the code.** If the name cannot be fetched the line stays away rather than reading
  "Signing in to mhpc", which tells a member less than the silence does and reads as a fault.
- **`%organisation%`, not `{0}`.** Keycloak runs every message through Java's `MessageFormat`, which
  claims anything in braces — `{organisation}` failed the whole template with
  `can't parse argument number: organisation` and a 500. A percent-delimited placeholder is
  invisible to `MessageFormat` and is substituted in JavaScript.

## Verified in the browser

| | Result |
|---|---|
| Meath gateway → Sign in | `Signing in to Meath Hunt Pony Club` |
| Then a **wrong password** | Line still shown; `redirect_uri` gone from the URL; "Invalid email or password." rendered as usual |
| Then the correct password | Signs in, lands on the Meath home page |
| Kildare gateway → Sign in | `Signing in to Kildare Hunt Pony Club`, and the stashed code updated |
| An unknown club code | Line hidden, form and password field untouched |

## Files

| File | What |
|---|---|
| `themes/account-user/login/resources/js/club.js` | New. Reads the code, remembers it, fetches the name, writes it as text |
| `themes/account-user/login/template.ftl` | The `#ips-club` line, hidden until it has a name |
| `themes/account-user/login/theme.properties` | `scripts=js/posts.js js/club.js` |
| `themes/account-user/login/messages/messages_en.properties` | `signingInTo` |
| `themes/account-user/login/resources/css/account.css` | `.kc-login-club`, including an explicit `[hidden]` rule — the class sets `display`, which would otherwise beat the attribute |

Theme changes need Keycloak restarted to be picked up: `docker compose restart keycloak`.

## What this does not do

The **org-admin** and **super-admin** login pages have their own themes and are untouched. Neither
starts from a club-branded page, so neither has the problem.
