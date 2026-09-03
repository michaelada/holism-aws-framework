import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import MembersDatabasePage from '../MembersDatabasePage';
import * as core from '@itsplainsailing/orgadmin-core';
import { createTestI18n } from '../../test/i18n-test-utils';

/**
 * Two things on the members database that did nothing.
 *
 * **Export to Excel was a stub.** `console.log('Exporting members...')` and a
 * return — no request, no file, no message. The test that would have caught it
 * is the plainest one there is: pressing the button must ask the server for
 * something.
 *
 * **The name was not a link.** Opening a member meant scrolling a table wide
 * enough to scroll to reach a pinned View button, when the name was already
 * under the reader's eye.
 */

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: vi.fn(),
}));

vi.mock('@itsplainsailing/orgadmin-core', async () => ({
  ...(await vi.importActual('@itsplainsailing/orgadmin-core')),
  useApi: vi.fn(),
  useOrganisation: vi.fn(),
  saveBlob: vi.fn(),
}));

vi.mock('@itsplainsailing/orgadmin-shell', async () => {
  const { shellMock } = await import('../../test/shell-mock');
  return shellMock();
});

const member = (over: Record<string, unknown> = {}) => ({
  id: 'm1',
  organisationId: 'org-1',
  membershipTypeId: 'mt-1',
  membershipTypeName: 'Junior',
  userId: 'u1',
  membershipNumber: 'KHP-0001',
  firstName: 'Saoirse',
  lastName: 'Ní Bhriain',
  formSubmissionId: 'fs1',
  dateLastRenewed: '2026-03-01',
  status: 'active',
  validUntil: '2027-03-01',
  labels: [],
  processed: true,
  paymentStatus: 'paid',
  createdAt: '2026-03-01',
  updatedAt: '2026-03-01',
  ...over,
});

const testI18n = createTestI18n('en-GB');
testI18n.addResourceBundle(
  'en-GB',
  'translation',
  {
    memberships: {
      actions: { exportToExcel: 'Export to Excel' },
      failedToExport: 'Failed to export members',
    },
  },
  true,
  true
);

/**
 * Press Export once the table has rows.
 *
 * The button is disabled while there is nothing to export, so a click fired
 * before the members arrive does nothing at all — which is correct, and would
 * otherwise make every test here look like the bug it is checking for.
 */
const clickExport = async () => {
  const button = await screen.findByRole('button', { name: /export to excel/i });
  await waitFor(() => expect(button).not.toBeDisabled());
  fireEvent.click(button);
};

const setup = ({
  members = [member()] as any[],
  onExport = undefined as undefined | ((body: any) => any),
} = {}) => {
  const execute = vi.fn().mockImplementation(({ url, method, data }) => {
    if (url.includes('/members/export')) {
      return onExport
        ? onExport(data)
        : Promise.resolve(new Blob(['x'], { type: 'application/vnd.ms-excel' }));
    }
    if (url.includes('/member-filters')) return Promise.resolve([]);
    if (url.includes('/membership-types')) return Promise.resolve([{ id: 'mt-1', name: 'Junior' }]);
    if (url.includes('/members')) return Promise.resolve(members);
    return Promise.resolve([]);
  });

  vi.mocked(core.useApi).mockReturnValue({
    execute,
    data: null,
    error: null,
    loading: false,
    reset: vi.fn(),
  } as never);

  vi.mocked(core.useOrganisation).mockReturnValue({
    organisation: { id: 'org-1', name: 'Kildare Hunt Pony Club' } as never,
    setOrganisation: vi.fn(),
    loading: false,
  } as never);

  render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <MembersDatabasePage />
      </MemoryRouter>
    </I18nextProvider>
  );

  return { execute };
};

const navigate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useNavigate).mockReturnValue(navigate);
});

describe('exporting the member database', () => {
  it('asks the server for a workbook, rather than logging to the console', async () => {
    const { execute } = setup();

    await clickExport();

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/api/orgadmin/organisations/org-1/members/export',
          // Without this axios parses the workbook as text and corrupts it.
          responseType: 'blob',
        })
      )
    );
  });

  it('exports what is on screen, by sending the ids the table is showing', async () => {
    const { execute } = setup({ members: [member(), member({ id: 'm2', membershipNumber: 'KHP-0002' })] });

    await clickExport();

    await waitFor(() => {
      const call = execute.mock.calls.find(([o]: any[]) => o.url.includes('/members/export'));
      // The filtered list, not "every member" — the whole point of a button
      // that sits beside a filtered table.
      expect(call![0].data).toEqual({ memberIds: ['m1', 'm2'] });
    });
  });

  it('hands the workbook to the browser', async () => {
    setup();

    await clickExport();

    await waitFor(() => expect(core.saveBlob).toHaveBeenCalled());
    const [, fileName] = vi.mocked(core.saveBlob).mock.calls[0];
    expect(fileName).toMatch(/^members_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  it('says so when the export fails, rather than failing silently', async () => {
    setup({ onExport: () => Promise.reject(new Error('nope')) });

    await clickExport();

    expect(await screen.findByText('Failed to export members')).toBeInTheDocument();
    expect(core.saveBlob).not.toHaveBeenCalled();
  });

  it('prefers the server’s own words where it sent any', async () => {
    setup({
      onExport: () =>
        Promise.reject({ response: { data: { error: 'No valid member ids were supplied' } } }),
    });

    await clickExport();

    expect(await screen.findByText('No valid member ids were supplied')).toBeInTheDocument();
  });

  it('offers nothing to export when the filters have emptied the table', async () => {
    setup({ members: [] });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /export to excel/i })).toBeDisabled()
    );
  });
});

describe('opening a member', () => {
  it('makes the name a link, so the pinned button need not be reached', async () => {
    setup();

    const name = await screen.findByRole('button', { name: 'Saoirse Ní Bhriain' });
    fireEvent.click(name);

    expect(navigate).toHaveBeenCalledWith('/members/m1');
  });
});
