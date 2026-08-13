# Exporting a report

Every report page in **Reports & Analytics** has always had an export button.
Until now all four did nothing:

```ts
// TODO: Implement CSV export functionality
console.log('Export events report for date range:', startDate, 'to', endDate);
```

The button was enabled, it responded to a click, and nothing arrived. A member
of staff had no way to tell that from an export that was simply slow.

## What it does now

| Page | Button | Downloads |
|---|---|---|
| Events report | Export to Excel | `events_report_<date>.xlsx` |
| Members report | Export to Excel | `members_report_<date>.xlsx` |
| Revenue report | Export to Excel | `revenue_report_<date>.xlsx` |
| Reports dashboard | Export Report → a menu | whichever of the three is chosen |

The file covers **the filters on screen** — the report pages' date range, and
the dashboard's recent-activity window — so what downloads matches what is
being looked at.

## Why the server builds it

`GET /api/orgadmin/organisations/:organisationId/reports/export` already
existed, fully implemented, and had never been called: it runs the same queries
the pages read and returns a formatted Excel workbook per report type, one
worksheet with headed columns.

So this is front-end work only, in keeping with the rule about reconciling
towards the existing backend. The alternative — building CSV in the browser
from the rows a page happens to hold — would have produced a worse file and a
second implementation of the same report.

Two consequences worth knowing:

- **It is Excel, not CSV.** The buttons used to say "Export to CSV" and the
  keys were `reporting.<report>.exportToCSV`; both were wrong about the format
  the system produces. The label is now one shared `reporting.exportToExcel`,
  matching the payments module's existing wording.
- **The workbook is not limited to the page.** The server queries afresh, so a
  report is complete even where a page paginates or aggregates.

## The dashboard has no report of its own

The dashboard summarises the three reports rather than being a fourth, and the
endpoint takes `events | members | revenue`. Its button therefore opens a menu
of the three instead of exporting something unnamed. Asking the endpoint for
`dashboard` is refused with a 400 that names the three it has.

## Failure is visible

An export that fails says so, in an alert on the page the user is looking at,
and the request is not retried behind them — the old stub's silence is the
thing being fixed, and a silent failure would be indistinguishable from it.

## Where the code is

| Piece | File |
|---|---|
| Request and download | `packages/orgadmin-core/src/reporting/exportReport.ts` |
| Pages | `reporting/pages/{Events,Members,Revenue}ReportPage.tsx`, `ReportingDashboardPage.tsx` |
| Endpoint | `packages/backend/src/routes/reporting.routes.ts` → `reporting.service.ts` |
| Strings | `reporting.exportToExcel`, `reporting.exporting`, `reporting.exportFailed`, in all six locales |

## Tests

| Suite | Covers |
|---|---|
| `exportReport.test.ts` | The request (blob, no retry, filters carried), the file name, and that the anchor and object URL are cleaned up even when the click throws — 10 tests |
| The four page suites | The button, its disabled states, that a click downloads the right report for the filters on screen, and that a failure is shown — including the dashboard's menu of three |
| `reporting-export.routes.test.ts` | The endpoint the UI now depends on: each report type, the attachment headers, the filters, the refusal of a type it does not have, and a failure arriving as a 500 rather than a broken file — 9 tests |

## Not done

`PaymentsListPage` has its own export, and it is odd: it calls the server's
payments export endpoint, discards the response, and then builds a CSV in the
browser from the rows on screen. It works, so it is left alone here, but the
server round trip is pointless and the file is not the one the server would
have produced.
