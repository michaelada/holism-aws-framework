# Holism — Project Rules for Claude

**Read the relevant module summary in [.claude/modules/](.claude/modules/) before opening source
files.** The summaries exist so most questions can be answered without reading code. Delve into the
source only when a summary is insufficient for the task at hand.

---

## 1. Working rules

### 1.1 Git — never touch it without an explicit request (strictly enforced)

Do NOT run any git operation unless the USER explicitly asks for it **in that message**. This
includes — but is not limited to — commits, pushes, branch creation/switching, merges, rebases,
cherry-picks, resets, stashes, tags, and force operations. Making code edits is fine; turning them
into git history is NOT, unless the USER says so. After finishing work, leave the changes in the
working tree and stop — do not offer to commit unless asked. "Go ahead" / "approved" on a coding
task does NOT imply permission to commit or push.

Read-only inspection (`git status`, `git diff`, `git show`, `git log`) is fine when it helps answer
a question.

### 1.2 Tests

- New functionality needs a full set of unit tests.
- When code changes, update the existing tests so they still pass.
- Backend uses **Jest**; every front-end package uses **Vitest**. Do not mix them.
- Before reporting a suite as broken, check whether the failures pre-date the change — this repo
  carries a substantial number of pre-existing failures (see §3.3).

### 1.3 Spec-driven development

For substantial new functionality, follow requirements → design → task breakdown, and include a set
of wireframes in the design showing how it might look. Wireframes live alongside the other feature
docs as `docs/*_WIREFRAMES.md`.

### 1.4 Documentation

Update documentation as part of any change. Feature docs live in [docs/](docs/) — one Markdown file
per feature or fix, plus `*_WIREFRAMES.md` per UI module. If a change alters behaviour a wireframe
describes, update that wireframe too.

### 1.5 Share code through the component library

When adding functionality, consider whether another front end (e.g. the Account User Interface)
could use it. If so, implement it in the shared **`packages/components`** package rather than in one
app. Functionality shared across org-admin modules belongs in **`packages/orgadmin-core`**.

### 1.6 Deployment artefacts move with the code

If a change affects how the system is built, configured, or run, update the deployment steps,
`docker-compose*.yml`, `terraform/`, and `infrastructure/` in line with it.

### 1.7 Prefer low-risk reconciliation

When the front end and backend disagree on a contract, adapt the front end to the existing backend
rather than expanding the backend, unless the user asks otherwise.

### 1.8 `.kiro/specs` is reference only

`.kiro/specs` is historical context for already-shipped features. Treat it as background, not as
current requirements, and do not resurrect its workflow in place of §1.3.

---

## 2. Module index

Each summary describes the module's purpose, structure, key files, conventions, and the questions
it can answer without opening code.

### Cross-cutting

| Summary | Covers |
|---|---|
| [architecture.md](.claude/modules/architecture.md) | Monorepo layout, auth, capability model, multi-tenancy, i18n, API and data conventions |
| [infrastructure.md](.claude/modules/infrastructure.md) | Docker, nginx, Keycloak, Postgres, Prometheus/Grafana, OpenTofu, scripts |

### Backend

| Summary | Package | Covers |
|---|---|---|
| [backend.md](.claude/modules/backend.md) | `packages/backend` | Express API — every route and service, middleware stack, migrations, database schema |

### Shared front-end packages

| Summary | Package | Covers |
|---|---|---|
| [components.md](.claude/modules/components.md) | `packages/components` | Shared library — metadata-driven forms/tables/wizards, payments, uploads, discounts |
| [orgadmin-shell.md](.claude/modules/orgadmin-shell.md) | `packages/orgadmin-shell` | Org-admin host app — auth, routing, module registry, layout, i18n and all locale files |
| [account-shell.md](.claude/modules/account-shell.md) | `packages/account-shell` | **Account User** host app — the member-facing front end; public directory and gateway, organisation resolution, responsive shell |
| [orgadmin-core.md](.claude/modules/orgadmin-core.md) | `packages/orgadmin-core` | The always-on org-admin package — `useApi`, `OrganisationContext`, shared utilities, and the index of the areas below |

### Org-admin core areas (always available, no capability gate)

| Summary | Area | Covers |
|---|---|---|
| [core-forms.md](.claude/modules/core-forms.md) | Form Builder | Reusable fields, forms, field groups, wizard steps; the forms other modules reference by id |
| [core-settings.md](.claude/modules/core-settings.md) | Settings | Organisation Details, Payment Settings, Email Templates, Branding; the `settings` JSONB merge rule |
| [core-payments.md](.claude/modules/core-payments.md) | Payments | Consolidated payment list, detail, refunds, lodgements |
| [core-reporting.md](.claude/modules/core-reporting.md) | Reports & Analytics | Dashboard plus events, members and revenue reports |
| [core-users.md](.claude/modules/core-users.md) | Users | Org-admin vs account users, roles, Keycloak invitations |

### Org-admin capability modules

| Summary | Package | Gating capability |
|---|---|---|
| [orgadmin-events.md](.claude/modules/orgadmin-events.md) | `packages/orgadmin-events` | `event-management` |
| [orgadmin-memberships.md](.claude/modules/orgadmin-memberships.md) | `packages/orgadmin-memberships` | `memberships` |
| [orgadmin-merchandise.md](.claude/modules/orgadmin-merchandise.md) | `packages/orgadmin-merchandise` | `merchandise` |
| [orgadmin-calendar.md](.claude/modules/orgadmin-calendar.md) | `packages/orgadmin-calendar` | `calendar-bookings` |
| [orgadmin-registrations.md](.claude/modules/orgadmin-registrations.md) | `packages/orgadmin-registrations` | `registrations` |
| [orgadmin-ticketing.md](.claude/modules/orgadmin-ticketing.md) | `packages/orgadmin-ticketing` | `event-ticketing` |

### Other front ends

| Summary | Package | Covers |
|---|---|---|
| [admin.md](.claude/modules/admin.md) | `packages/admin` | Super-admin UI — organisations, org types, roles, users |
| [frontend.md](.claude/modules/frontend.md) | `packages/frontend` | Metadata-repository UI — object/field definitions and instances |

---

## 3. Conventions that apply everywhere

### 3.1 Where new code goes

| Change | Location |
|---|---|
| Used by more than one front end | `packages/components` |
| Used by more than one org-admin module | `packages/orgadmin-core` |
| Specific to one capability | that capability's package |
| Org-admin routing, layout, auth, translations | `packages/orgadmin-shell` |
| Any API endpoint | a router in `packages/backend/src/routes` plus a service in `src/services` |

### 3.2 Translations

All org-admin UI strings are i18n keys resolved against
`packages/orgadmin-shell/src/locales/<locale>/translation.json`. There are **six locales** —
`en-GB`, `de-DE`, `es-ES`, `fr-FR`, `it-IT`, `pt-PT` — and every new key must be added to **all
six**. Never hard-code user-facing English in a component. Keep the JSON diff minimal: targeted
edits, never a reformat of the whole file.

### 3.3 Test suite health

Several suites carry pre-existing failures unrelated to current work — most often tests asserting
English text while the mocked `t()` returns raw i18n keys, and property-based tests with unseeded
generators that fail intermittently. When a suite fails:

1. Check whether the same tests fail on unmodified sources.
2. Treat a failure as yours only if it is new, or if your change explains it.
3. State plainly which failures pre-date the change rather than silently fixing unrelated ones.

### 3.4 Front-end testing patterns worth reusing

- MUI `Select` opens on `fireEvent.mouseDown`, not `click`. `userEvent.click` on a `Select` in the
  page-level suites can hang the run.
- A `multiple` MUI `Select` keeps its menu open after a choice, and the open menu's backdrop covers
  the rest of the dialog — so any button behind it is unclickable. Close it with
  `fireEvent.keyDown(listbox, { key: 'Escape' })`; clicking another element does not work, because
  the click never reaches the backdrop MUI listens to.
- Date-picker tests need the real `LocalizationProvider` — stubbing it removes the context the
  pickers read, producing MUI's "Can not find the date and time pickers localization context". That
  message also blames duplicate installs; check for a stub first. `@mui/x-date-pickers` must be
  listed under Vitest's `server.deps.inline` (not the deprecated `deps.inline`, which is ignored),
  or the provider gets the ESM build while the pickers get the CJS one.
- Mocks of `useApi` / `useOrganisation` **must return stable references**. Components reload data in
  a `useEffect` keyed on `execute` / `organisation` identity, so a fresh object per render loops
  forever and the test times out.
- Use `vi.hoisted()` when a `vi.mock` factory needs values defined in the test file.
- Several suites mock `t()` as the identity function, so assertions should match i18n keys rather
  than English text.

### 3.5 Running things locally

Everything except the app under development normally runs in Docker.

```bash
docker compose stop backend       # frees :3000 when running the API locally
npm run dev:backend               # http://localhost:3000  (reads packages/backend/.env)
npm run dev:orgadmin              # http://localhost:5175  (org admin)
npm run dev:account               # http://localhost:5176  (account user)
npm run dev:admin                 # http://localhost:5174  (super admin)
npm run dev:frontend              # http://localhost:5173  (metadata UI)
```

Each Vite dev server proxies `/api` to `localhost:3000`. `orgadmin-shell` aliases the other
org-admin packages to their `src` directories, so edits hot-reload without rebuilding them.

### 3.6 Keeping these summaries accurate

When a change adds or removes a page, route, service, capability, or module, update the
corresponding `.claude/modules/*.md` in the same pass — the same obligation as §1.4 for `docs/`. A
stale summary is worse than no summary, because it gets trusted without being checked.
