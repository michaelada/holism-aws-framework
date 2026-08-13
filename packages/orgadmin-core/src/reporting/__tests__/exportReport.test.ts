/**
 * Downloading a report.
 *
 * The subject here is the request and what happens to the file, because that
 * is where an export goes wrong quietly: asked for as text, the workbook
 * arrives corrupted and opens as gibberish, and a failure that is swallowed
 * looks exactly like the console-logging stub this replaced.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportReport, reportFileName, saveBlob } from '../exportReport';

const ORG = 'org-1';

describe('exportReport', () => {
  let execute: ReturnType<typeof vi.fn>;
  let click: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    execute = vi.fn().mockResolvedValue(new Blob(['workbook'], { type: 'application/vnd.ms-excel' }));

    click = vi.fn();
    // jsdom implements neither, and a click that navigates would end the test.
    global.URL.createObjectURL = vi.fn(() => 'blob:report');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asks the server for the workbook it already knows how to build', async () => {
    await exportReport(execute, ORG, 'events', {
      startDate: '2026-01-01',
      endDate: '2026-03-31',
    });

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: `/api/orgadmin/organisations/${ORG}/reports/export`,
        params: expect.objectContaining({
          reportType: 'events',
          startDate: '2026-01-01',
          endDate: '2026-03-31',
        }),
      })
    );
  });

  /** Parsed as text, a workbook downloads as something Excel cannot open. */
  it('asks for it as a blob', async () => {
    await exportReport(execute, ORG, 'members');

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ responseType: 'blob' })
    );
  });

  it('does not retry a failed export behind the user', async () => {
    await exportReport(execute, ORG, 'revenue');

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ retryCount: 0 }));
  });

  it('carries the report filters, and omits the ones not set', async () => {
    await exportReport(execute, ORG, 'members', { membershipTypeId: 'type-7' });

    const { params } = execute.mock.calls[0][0] as { params: Record<string, unknown> };
    expect(params.membershipTypeId).toBe('type-7');
    expect(params.startDate).toBeUndefined();
    expect(params.eventId).toBeUndefined();
  });

  it('saves the file under a name that says what it is and when', async () => {
    const saved: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(this.download);
    });

    await exportReport(execute, ORG, 'revenue', {}, new Date('2026-08-13T09:00:00Z'));

    expect(saved).toEqual(['revenue_report_2026-08-13.xlsx']);
  });

  /**
   * The failure has to reach the caller. An export that quietly does nothing
   * is indistinguishable from the stub this replaced, and the member of staff
   * is left waiting for a file that will never arrive.
   */
  it('throws when the request fails', async () => {
    execute.mockRejectedValue(new Error('Failed to export report'));

    await expect(exportReport(execute, ORG, 'events')).rejects.toThrow('Failed to export report');
  });

  it('throws when what came back is not a file', async () => {
    execute.mockResolvedValue({ error: 'Invalid report type' });

    await expect(exportReport(execute, ORG, 'events')).rejects.toThrow(/not come back as a file/i);
  });
});

describe('reportFileName', () => {
  it('names the report and the day it was taken', () => {
    expect(reportFileName('members', new Date('2026-12-01T23:30:00Z'))).toBe(
      'members_report_2026-12-01.xlsx'
    );
  });
});

describe('saveBlob', () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:report');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Otherwise a page exported from twice leaks both the anchor and the blob. */
  it('cleans up the anchor and the object URL', () => {
    saveBlob(new Blob(['x']), 'x.xlsx');

    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:report');
  });

  it('cleans up even when the click throws', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => saveBlob(new Blob(['x']), 'x.xlsx')).toThrow('blocked');
    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});
