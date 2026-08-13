/**
 * Downloading a report.
 *
 * The backend already builds these: `/reports/export` returns a formatted
 * Excel workbook per report type, built from the same queries the pages read,
 * and it has been sitting there unused while every export button on every
 * report page logged to the console and did nothing.
 *
 * So this is the front-end half — ask for the workbook and hand it to the
 * browser — rather than a second, client-side implementation that could only
 * ever export the rows a page happened to have fetched.
 */

export type ReportType = 'events' | 'members' | 'revenue';

export interface ReportExportFilters {
  /** ISO date (yyyy-mm-dd), as the report pages hold them. */
  startDate?: string;
  endDate?: string;
  eventId?: string;
  membershipTypeId?: string;
}

/** The `execute` from `useApi`, narrowed to what this needs. */
export type ExecuteRequest = (options: Record<string, unknown>) => Promise<unknown>;

/**
 * The file name a member of staff will see in their downloads folder.
 *
 * The server sends one in `Content-Disposition`, but reading a response header
 * through XHR requires the server to expose it by name in
 * `Access-Control-Expose-Headers`, and it does not — so rather than depend on
 * a header that silently is not there, the name is built here from the same
 * parts.
 */
export const reportFileName = (reportType: ReportType, on: Date): string =>
  `${reportType}_report_${on.toISOString().split('T')[0]}.xlsx`;

/**
 * Save a blob to the user's downloads.
 *
 * The anchor is removed and the object URL revoked whatever happens: a page
 * that exports repeatedly would otherwise accumulate both, and the blobs are
 * held in memory until the URL is released.
 */
export const saveBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  try {
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
};

/**
 * Fetch a report as a workbook and save it.
 *
 * Throws if the request fails, so the page can say so — an export that
 * silently does nothing is what this replaces.
 */
export const exportReport = async (
  execute: ExecuteRequest,
  organisationId: string,
  reportType: ReportType,
  filters: ReportExportFilters = {},
  now: Date = new Date()
): Promise<void> => {
  const response = await execute({
    method: 'GET',
    url: `/api/orgadmin/organisations/${organisationId}/reports/export`,
    params: {
      reportType,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      eventId: filters.eventId || undefined,
      membershipTypeId: filters.membershipTypeId || undefined,
    },
    // Without this axios parses the workbook as text and corrupts it.
    responseType: 'blob',
    // A failed export should reach the user as a message, not as a retry loop.
    retryCount: 0,
  });

  if (!(response instanceof Blob)) {
    throw new Error('The report did not come back as a file');
  }

  saveBlob(response, reportFileName(reportType, now));
};
