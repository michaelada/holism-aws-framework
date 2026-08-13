# Reports & Analytics — `packages/orgadmin-core/src/reporting`

Cross-module reporting: a summary dashboard plus three drill-down reports over events, members and
revenue.

Part of `orgadmin-core`, always available. (Note there is also a `reporting` **capability** in the
seeded list, but this module does not declare it — the reports are present for every organisation.)

## Routes (`reporting/index.ts` → `reportingModule`)

| Path | Page |
|---|---|
| `reporting` | `ReportingDashboardPage` |
| `reporting/events` | `EventsReportPage` |
| `reporting/members` | `MembersReportPage` |
| `reporting/revenue` | `RevenueReportPage` |

## How the reports work

Each page uses `useApiGet` (a thin wrapper over `useApi` in `orgadmin-core/src/hooks/useApi.ts`)
against an organisation-scoped endpoint, re-fetching when the filters change:

```
GET /api/orgadmin/organisations/:organisationId/reports/dashboard
GET /api/orgadmin/organisations/:organisationId/reports/events?startDate=&endDate=
GET /api/orgadmin/organisations/:organisationId/reports/members
GET /api/orgadmin/organisations/:organisationId/reports/revenue
GET /api/orgadmin/organisations/:organisationId/reports/export
```

All five are implemented in backend `reporting.routes.ts` → `reporting.service.ts`.

The date-range reports default to **the last three months** (start = today − 3 months, end =
today). Summary totals — event count, total entries, total revenue — are **derived client-side**
with `useMemo` from the returned rows, not returned by the API. If a headline figure disagrees with
a row-level total, the reduction in the page is where to look.

## Known gap — export is not implemented

Every report page renders an export button, but all four handlers are stubs:

```ts
// TODO: Implement CSV export functionality
console.log('Export events report for date range:', startDate, 'to', endDate);
```

That applies to `ReportingDashboardPage`, `EventsReportPage`, `MembersReportPage` and
`RevenueReportPage`. The backend `/reports/export` endpoint exists and is unused by the UI, so
wiring export up is front-end work. Note the payments module has its own working export at
`/api/orgadmin/payments/export` — a different endpoint.

## Tests

The `EventsReportPage`, `MembersReportPage` and `RevenueReportPage` suites were rewritten against
the current pages: they use
`src/test/renderWithProviders` (these pages need `OrganisationProvider`) and
`src/test/i18nTestUtils`, which resolves keys against the real en-GB bundle so assertions read as
the English a user sees. The older suites asserted a response shape the API no longer returns —
`{ sources, monthlyBreakdown, summary }` rather than a flat row array.

`ReportingDashboardPage.test.tsx` and `reporting-i18n.test.tsx` are **still failing** for the same
reasons and have not yet been migrated.

## Where to look for what

| Question | Start at |
|---|---|
| "Why does the export button do nothing?" | The TODO stubs above |
| "Where do report figures come from?" | Backend `reporting.service.ts` |
| "Why do totals differ from the rows?" | The client-side `useMemo` reductions in each page |
| "What date range is used by default?" | The `useState` initialisers — last three months |
| "Is reporting capability-gated?" | No — `reportingModule` declares no `capability` |
