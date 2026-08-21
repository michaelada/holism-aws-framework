# Infrastructure, deployment and tooling

Everything outside `packages/`. Per project rule §1.6, code changes that alter how the system is
built, configured or run must be reflected here in the same pass.

## Local development (`docker-compose.yml`)

| Service | Port | Notes |
|---|---|---|
| `postgres` | 5432 | `aws_framework` / `framework_user`; healthchecked |
| `keycloak` | 8080 | Realm `aws-framework` |
| `backend` | 3000 | Built from `packages/backend/Dockerfile`; mounts `src` and `migrations` read-only |
| `nginx` | 80, 443 | Reverse proxy; `host.docker.internal` mapped so it can reach host-run dev servers |
| `prometheus` | 9090 | Scrapes the backend's `/metrics` |
| `grafana` | 3001 → 3000 | Dashboards provisioned from `infrastructure/grafana/provisioning` |

The **front ends are deliberately not containerised for development** — the compose file's frontend
service is commented out because the monorepo aliases need the workspace on disk. Run them with
`npm run dev:*` on the host.

Running the backend locally means stopping the container first (`docker compose stop backend`);
both bind `:3000`. `packages/backend/.env` is already pointed at the Dockerised Postgres
(`127.0.0.1:5432`) and Keycloak (`localhost:8080`), and `ALLOWED_ORIGINS` already lists 5174/5175.

`docker-compose.prod.yml` adds containerised `frontend`, `admin` and `orgadmin` services.

## nginx (`infrastructure/nginx/`)

`default.conf` (HTTP) and `default-ssl.conf` (TLS) route:

| Location | Target |
|---|---|
| `/health` | health endpoint |
| `/api/` | `backend` |
| `/api/admin/` | `backend` (separate block — tighter rate limiting) |
| `/auth/` | `keycloak` |
| `/admin` | host `:5174` (super-admin dev server) |
| `/` | host `:5173` |

Custom `50x.html` and `429.html` error pages. Adding a front end or an API prefix means editing
both conf files.

## The account app is a PWA

`packages/account-shell` builds a service worker and a manifest through `vite-plugin-pwa`
(`generateSW`), scoped to `/account/`. Two consequences for deployment:

- **The shell is precached, so a deploy must not be served from a cache that outlives it.** The
  plugin is configured `registerType: 'autoUpdate'` with `cleanupOutdatedCaches`, which handles the
  service worker's own caches — but an aggressive CDN or nginx `Cache-Control` on `sw.js` would pin
  members to an old build. `sw.js` must not be cached at the edge.
- **`public/icon.svg` is a placeholder.** A designed PNG set (192, 512, maskable) belongs there
  before release ([docs/ACCOUNT_USER_APP_PHASE12_OFFLINE.md](../../docs/ACCOUNT_USER_APP_PHASE12_OFFLINE.md)).

API responses are deliberately **not** in the service worker's cache — they are held per member by
the app and cleared on sign-out, and a second copy would outlive that.

## Other infrastructure

- `infrastructure/init-db.sql` — initial database bootstrap.
- `infrastructure/keycloak/` — realm setup notes (`KEYCLOAK_SETUP.md`) and custom themes.
  - Four login themes; `org-admin` and `account-user` are the two real login pages. Both now render
    **platform posts** beside the sign-in form: a two-column shell in `template.ftl`, cards drawn by
    `resources/js/posts.js`, styling in each theme's own CSS. The script is a **second
    implementation** of `packages/components`' `PostCard` — FreeMarker has no React — and the two
    must be kept in step by hand.
  - It fetches `/api/public/posts?surface=…` relatively, which is correct wherever nginx serves
    Keycloak under `/auth/` and the API under `/api/` on one origin. In development it detects port
    8080 and falls back to `http://localhost:3000`; `ipsApiBase` in `theme.properties` overrides
    both for a split-host setup. Nothing to configure in a normal deployment.
  - The **account-user** theme also carries a `Powered by ItsPlainSailing.com` footer under the
    card — small logo plus caption, linked with `target="_blank" rel="noopener"` so a half-filled
    registration form is not lost to a click. It lives in `template.ftl` inside `.ips-login-col`,
    so it appears on every page of that theme (sign-in, register, forgotten password) and stays
    with the form when the layout stacks. Not applied to the org-admin theme. The copyright year is
    `.now?string('yyyy')` passed into the `copyright` message as `{0}`, never a literal. The React
    twin is `PoweredByFooter` in `packages/components`, used by the in-app register page.
  - ⚠️ `template.ftl` opens **three** nested divs before the card (`ips-shell` → `ips-login-col` →
    `kcLoginClass`). Editing near the tail is where a `</div>` goes missing, and the symptom is not
    a broken page: the `<aside>` ends up *inside* the login column and the announcements silently
    render underneath the card instead of beside it.
  - **The org-admin theme offers no self-registration.** `login.ftl` passes `displayInfo=false`, so
    the parent theme's "New user? Create Account" never renders. An organisation administrator's
    account is created *for* them — by a full administrator of their own organisation, or by a super
    admin in the Platform Admin UI — so the link led only to
    "User is not an organization administrator", having created a stray Keycloak user on the way.
    Done in the theme rather than on the realm: `registrationAllowed` is realm-wide, and switching
    it off would take **member** self-registration with it, which the account-user theme relies on.
    This is a correctness fix, not a security boundary — org-admin access needs an
    `organization_users` row with `user_type = 'org-admin'`, which self-registration cannot create.
  - Keycloak runs `start-dev`, so theme edits need no restart — just reload.
  - See [docs/PLATFORM_POSTS.md](../../docs/PLATFORM_POSTS.md).
- **Keycloak clients are created by hand; there is no realm import.** `aws-framework-frontend`,
  `aws-framework-admin`, `orgadmin-client` and `account-app` each have to be created in the
  `aws-framework` realm before their app can sign anyone in — a missing one fails with "Client not
  found" before any credentials are entered. Per-app guides: docs/ORGADMIN_KEYCLOAK_SETUP.md and
  docs/ACCOUNT_APP_KEYCLOAK_SETUP.md. A fresh machine or CI environment needs all four.
- **`account-password-check` is the exception: the seed creates it.** A *confidential*,
  direct-grant-only client that lets the backend verify a member's current password when they change
  their password or email address from the account app — Keycloak's Admin API can set a password but
  cannot check one. `ensurePasswordCheckClient` in `scripts/seed/keycloak.ts` creates it and
  reconciles an existing one, because a client with direct grants switched off or the wrong secret
  fails at the worst possible moment: a member typing their correct password and being told it is
  wrong. The backend needs `KEYCLOAK_PASSWORD_CHECK_CLIENT_ID` and
  `KEYCLOAK_PASSWORD_CHECK_CLIENT_SECRET`; **unset, every password check fails**, so the service
  refuses to run rather than reporting a wrong password. Deployed environments must set their own
  secret — the seed's default is a development value and the seed refuses non-local Keycloak anyway.
  It deliberately has no browser flow, no service account and no redirect URIs, so it cannot sign
  anybody in to anything. See docs/ACCOUNT_SELF_SERVICE_CREDENTIALS.md §3.4.
- **Every front-end client needs an `oidc-audience-mapper` adding `aws-framework-backend`.** The
  backend verifies bearer tokens with `audience: KEYCLOAK_CLIENT_ID`, and a token minted for a
  front-end client does not carry that audience on its own. Without the mapper, sign-in succeeds and
  public endpoints work while **every authenticated call returns `UNAUTHORIZED / Invalid token`** —
  a failure that looks like anything but a missing protocol mapper.
- `infrastructure/prometheus/` — scrape config and `alerts/`.
- `infrastructure/grafana/provisioning/` — datasources and dashboards.
- `infrastructure/monitoring/README.md` — how the monitoring stack fits together.

## Deploying the whole platform to one instance (`terraform/environments/testing/`)

For testing, and deliberately a different shape from `staging/` and `production/`: one EC2 instance
running `docker-compose.deploy.yml`, no NAT gateway, no RDS, no load balancer, no second box for
monitoring. **~$20–33/month against staging's ~$145.**
Full record: [docs/DEPLOY_SINGLE_INSTANCE.md](../../docs/DEPLOY_SINGLE_INSTANCE.md).

The pieces, and why each exists:

| | |
|---|---|
| `docker-compose.deploy.yml` | The *deployment* stack. `docker-compose.yml` is for development — it proxies the front ends to Vite dev servers on the host and publishes every port |
| `Dockerfile.web` | Builds all four front ends and serves them from nginx. `PUBLIC_URL` is **compiled into the bundles**, so an image belongs to one hostname |
| `infrastructure/nginx/deploy.conf` | One origin: `/account`, `/orgadmin`, `/admin`, `/metadata`, with `/api` and `/auth` proxied. No CORS, one certificate |
| `infrastructure/keycloak/realm-import.json` | The realm, all seven clients and their audience mappers, held with placeholders instead of secrets |
| `scripts/deploy/bootstrap.sh` | Generates secrets **once**, renders the realm, migrates, starts, optionally seeds |

Things that reliably go wrong here — every one of them has actually happened:

- **The realm is imported once and ignored afterwards.** Regenerating secrets later leaves the realm
  holding one set and the backend using another — which presents as "sign-in works, every API call
  is 401". `bootstrap.sh` is idempotent for exactly this reason.
- **Keycloak must be told it is behind the TLS-terminating nginx**, and the variable depends on the
  version. The image pinned here is **23.0**, which reads `KC_PROXY: edge`; `KC_PROXY_HEADERS` was
  introduced in **24** and on 23 is silently ignored. Get it wrong and Keycloak advertises URLs for
  the address it was reached on — `https://itsps.org:8443/...` — and the sign-in loop never closes.
- **`KEYCLOAK_ISSUER_URL` is a second, different variable from `KEYCLOAK_URL`.** The backend reaches
  Keycloak internally but must verify `iss` against the *public* name the browser was issued a token
  for. Set only `KEYCLOAK_URL` and you get the other "sign-in works, every API call is 401" — see
  [backend.md](backend.md).
- **A front end can build cleanly and still be a blank page.** A `manualChunks` rule that splits
  mutually-dependent modules across chunks produces an import cycle; the browser evaluates one side
  before the other has initialised. `Dockerfile.web` runs `scripts/check-chunk-cycles.mjs` over all
  four `dist` directories and fails the image rather than shipping it. `npm run check:chunks` is the
  same check locally. Match chunk rules on the **package name**, never a path substring.
- **The front-end build is the memory peak**, not anything at run time. The `user_data` adds 2 GB of
  swap before the first build, because on a 2 GB instance it is otherwise killed with an error that
  blames esbuild.

`admin` and `frontend` gained `basename={import.meta.env.BASE_URL}` so they can be served under a
path prefix at all — in development that is `/` and nothing changes.

**No front end is served from the root, so no asset may be referenced from it.** All four sit under
a prefix (`/account/`, `/orgadmin/`, `/admin/`, `/metadata/`). Vite rewrites absolute paths it finds
in `index.html`, which is why favicons declared there work and hide the problem; it does **not**
rewrite string literals in components. A `src="/logo.png"` in a component therefore 404s in the
deployment and nowhere else. Build asset paths from `import.meta.env.BASE_URL`.

Two traps in that value, both of which have bitten:

- It is the configured `base` **verbatim**. `account-shell` and `orgadmin-shell` were written as
  `base: '/account'`, so `` `${BASE_URL}favicon.png` `` produced `/accountfavicon.png`. All four are
  now normalised to a trailing slash, and the two call sites force one anyway.
- Under Vitest, `BASE_URL` is whatever that package's `vite.config` says — `/` for `admin`, but
  `/account/` for `account-shell`. A test written against the default passes for both the correct
  and the incorrect implementation, so cover the deployed base explicitly with `vi.stubEnv`.

## OpenTofu (`terraform/`)

```
modules/     networking, compute, database, secrets, monitoring
environments/ staging, production
test/        validate.sh, syntax-check.sh, plan.sh, ci-test.sh, run-all-tests.sh, TEST_COVERAGE.md
```

Changes that add configuration (a new environment variable, secret, port or service) need the
matching module and both environments updated. `terraform/test/run-all-tests.sh` validates before
planning.

**The CLI is `tofu`, not `terraform`.** The configurations are ordinary HCL and the directory keeps
its name, but every script, workflow and instruction invokes OpenTofu — `tofu init`, `tofu plan`,
`tofu apply`. The `terraform {}` blocks inside `.tf` files are language syntax and stay as they are,
as do the `terraform.tfstate` keys and the `aws-web-framework-terraform-state-*` buckets, which are
real resource names.

## Scripts (`scripts/`)

| Script | Purpose |
|---|---|
| `generate-test-data.ts` | Seed data (`npm run generate-test-data`) |
| `verify-deployment.sh` | Post-deploy checks |
| `setup-keycloak-theme.sh` | Install the custom Keycloak theme |
| `test-nginx-config.sh` | Validate nginx configuration |
| `add-*-translations.js`, `update-memberships-i18n.sh` | Bulk i18n key insertion across the six locale files |
| `check-orgadmin-user.sql` | Diagnose org-admin access problems |

## Repo-level tests (`__tests__/`)

Jest, run by `npm run test:root`:
- `project-structure.test.ts` — enforces the expected workspace layout.
- `ci-cd-workflows.test.ts` — validates the CI/CD workflow definitions.

Adding or renaming a package can therefore fail these tests; update them deliberately.

## Documentation (`docs/`)

One Markdown file per feature or fix, plus `*_WIREFRAMES.md` per UI module and a
`docs/conversation/` archive of prior working sessions. Notable entry points: `DEPLOYMENT.md`,
`CICD_PIPELINE.md`, `DOCKER_CONFIGURATION.md`, `FRONTEND_SETUP.md`, `SECURITY.md`,
`EVENTS_MODULE_WIREFRAMES.md`, `MEMBERSHIPS_MODULE_WIREFRAMES.md`.

## Where to look for what

| Question | Start at |
|---|---|
| "How do I run the stack locally?" | `docker-compose.yml` + CLAUDE.md §3.5 |
| "Why is this URL 404 in Docker but fine in dev?" | `infrastructure/nginx/default.conf` |
| "Where do I add a new environment variable?" | `docker-compose*.yml`, `packages/backend/.env.example`, `terraform/modules/*`, both environments |
| "How is the DB schema created from scratch?" | `infrastructure/init-db.sql` then `packages/backend/migrations/` |
| "Where are alerts and dashboards defined?" | `infrastructure/prometheus/alerts`, `infrastructure/grafana/provisioning` |

## Demo seed

`npm run seed:demo -- --reset` rebuilds a local environment into a known state: one organisation
type, **four** pony clubs, 21 logins, 16 events across every entry-window state, application forms,
membership types with 32 members for the current season — including parents holding their children's
memberships and renewals falling due — shop products, booking calendars and 30 discounts spread so
every club has a list for each capability it holds. Discount keys are scoped to their organisation,
so a shared definition like `familyMembership` resolves to each club's own version rather than
leaking one club's discount into another's records. It writes to **both** Postgres and Keycloak, and
`--reset` deletes all application data plus the Keycloak users it created.

**Three clubs each leave a capability switched off on purpose** — Kildare alone has the shop, Laois
alone has bookings, Ward Union takes no card payments — so the *absence* of a capability stays
testable. **Meath Hunt Pony Club (`mhpc`) has all 22**, including the registrations and event
ticketing nothing else exercises, so one login reaches the whole product. It takes them through an
`allCapabilities` flag rather than a copied list, which would go stale the moment the type gained
one; the additions went into the type's `optInCapabilities` too, so the other three are unchanged.

**Registrations are about an animal, not a person.** Meath registers horses on a `horseRegistration`
form built from passport vocabulary, and the three identities a registration keeps apart —
`entity_name` (the horse), `owner_name` (whoever the passport says) and `user_id` (the member whose
login it sits under) — are deliberately three different answers in the fixture. Both period
mechanisms appear: an annual type with a fixed `valid_until`, and a rolling three-month one.

**Every club gets a Stripe test connected account** (`scripts/seed/stripe.ts`), because a club
without one cannot take a card payment and the whole checkout path is then unreachable. They are
`custom` accounts — a `standard` one stays `charges_enabled: false` until a human completes hosted
onboarding — created against the platform's own `sk_test_` key. **A live key is refused outright,
with no override.** Accounts carry `metadata.seededBy` and `--reset` deletes only those; `--no-stripe`
skips the step. Nothing is copied from a production platform: live and test are separate universes
in Stripe, and this application keeps no per-organisation keys in any case. See
`docs/SEED_STRIPE_AND_MEATH.md`.

**Every date is an offset from the run**, resolved in `scripts/seed/dates.ts`, so the same fixture
appears whenever it is run — entries still closing this week, a membership still due for renewal, a
blocked week still ahead. The membership season rolls to the following year within 60 days of
year-end, so a December run does not leave the whole cohort inside the renewal window.
`scripts/seed/__tests__/dates.test.ts` exercises that against dates the calendar has not reached,
which is why `jest.config.js` has `scripts` in its roots.

It refuses to run against `NODE_ENV=production`, or against a non-local database or Keycloak without
an explicit `SEED_ALLOW_REMOTE_*` override. Source in `packages/backend/scripts/seed/`; see
`docs/EVENTS_DEMO_SEED.md` and `docs/SEED_STRIPE_AND_MEATH.md`.
