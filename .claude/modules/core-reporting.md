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

## Export

Every report page downloads a **formatted Excel workbook built by the server** — the
`/reports/export` endpoint, which had existed unused while all four buttons logged to the console.
`reporting/exportReport.ts` makes the request (`responseType: 'blob'`, no retry) and saves the
file; the pages supply the filters they are showing and display a failure rather than swallowing
it.

The dashboard summarises the three reports and is not one itself, so its button opens a **menu of
the three** rather than exporting something unnamed; the endpoint takes `events | members |
revenue` and refuses anything else with a 400.

The label is one shared `reporting.exportToExcel`, not the old per-report `exportToCSV` — the
system produces workbooks, and the old key said otherwise. See
docs/REPORTING_EXPORT.md.

Note the payments module has its own export at `/api/orgadmin/payments/export` — a different
endpoint, and an odd implementation: `PaymentsListPage` calls it, discards the response, and builds
a CSV client-side from the rows on screen.

## Tests

The `EventsReportPage`, `MembersReportPage` and `RevenueReportPage` suites were rewritten against
the current pages: they use
`src/test/renderWithProviders` (these pages need `OrganisationProvider`) and
`src/test/i18nTestUtils`, which resolves keys against the real en-GB bundle so assertions read as
the English a user sees. The older suites asserted a response shape the API no longer returns —
`{ sources, monthlyBreakdown, summary }` rather than a flat row array.

`ReportingDashboardPage.test.tsx` and `reporting-i18n.test.tsx` have since been migrated too, and
the whole module passes. Each page suite mocks **two** API hooks: `useApiGet` for the report on
display and `useApi` for the export, which asks for a workbook rather than JSON — auto-mocking the
module leaves the second returning `undefined`, which surfaces as "Cannot destructure property
'execute'".

## Where to look for what

| Question | Start at |
|---|---|
| "Where does the exported file come from?" | `reporting/exportReport.ts` → backend `/reports/export` |
| "Where do report figures come from?" | Backend `reporting.service.ts` |
| "Why do totals differ from the rows?" | The client-side `useMemo` reductions in each page |
| "What date range is used by default?" | The `useState` initialisers — last three months |
| "Is reporting capability-gated?" | No — `reportingModule` declares no `capability` |
