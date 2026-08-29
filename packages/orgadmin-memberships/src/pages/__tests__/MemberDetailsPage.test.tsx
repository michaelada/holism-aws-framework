import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { MemoryRouter } from 'react-router-dom';
import MemberDetailsPage from '../MemberDetailsPage';

/**
 * One member, as a club secretary sees them.
 *
 * Two of the actions here write immediately, with no save button: changing the
 * status and marking a member processed. That makes their failure handling the
 * thing worth pinning — the page shows the new value optimistically, so a write
 * the server refused must not leave the screen claiming a change that did not
 * happen. It also has to cope with a member whose membership type or answers
 * were never recorded, rather than rendering nothing.
 *
 * Uploaded files are fetched as short-lived signed URLs on demand, so the
 * download link asks the server for one at the moment it is clicked instead of
 * printing a URL that has already expired.
 */

const { execute, navigate, params } = vi.hoisted(() => ({
  execute: vi.fn(),
  navigate: vi.fn(),
  params: { current: { id: 'mem-1' } as { id?: string } },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
  useParams: () => params.current,
}));

vi.mock('@aws-web-framework/orgadmin-shell', async () => {
  const { shellMock } = await import('../../test/shell-mock');
  return shellMock();
});

vi.mock('@aws-web-framework/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
  useOrganisation: () => ({
    organisation: { id: 'org-1', name: 'Meath' },
    setOrganisation: vi.fn(),
  }),
}));

const MEMBER = {
  id: 'mem-1',
  membershipTypeId: 'mt-1',
  formSubmissionId: 'sub-1',
  membershipNumber: 'M-0042',
  status: 'active',
  processed: false,
  labels: ['committee'],
};

const TYPE = { id: 'mt-1', name: 'Senior Member' };

const SUBMISSION = {
  id: 'sub-1',
  submissionData: { first_name: 'Aoife', surname: 'Byrne' },
};

const respond = (over: Record<string, unknown> = {}) =>
  execute.mockImplementation(async ({ url, method }: { url: string; method: string }) => {
    if (method === 'PATCH') return over.updated ?? null;
    if (url.includes('/files/')) return over.file ?? { url: 'https://files/signed-url' };
    if (url.includes('/members/')) return 'member' in over ? over.member : MEMBER;
    if (url.includes('/membership-types/')) return 'type' in over ? over.type : TYPE;
    if (url.includes('/form-submissions/')) return 'submission' in over ? over.submission : SUBMISSION;
    return null;
  });

const renderPage = async () => {
  renderWithI18n(
    <MemoryRouter>
      <MemberDetailsPage />
    </MemoryRouter>
  );
  await waitFor(() => expect(execute).toHaveBeenCalled());
};

const loaded = () => screen.findByText('M-0042');

const statusSelect = () => screen.getByRole('combobox', { name: /status/i });

const chooseStatus = (value: string) => {
  fireEvent.mouseDown(statusSelect());
  fireEvent.click(screen.getByRole('listbox').querySelector(`[data-value="${value}"]`)!);
};

const patches = () => execute.mock.calls.map(([r]) => r).filter((r) => r.method === 'PATCH');

beforeEach(() => {
  vi.clearAllMocks();
  params.current = { id: 'mem-1' };
  respond();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MemberDetailsPage — showing the member', () => {
  it('reads the member named in the route', async () => {
    await renderPage();
    await loaded();

    expect(execute).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/orgadmin/members/mem-1',
    });
  });

  it('reads the membership type and the answers they gave', async () => {
    await renderPage();
    await loaded();

    const urls = execute.mock.calls.map(([r]) => r.url);
    expect(urls).toContain('/api/orgadmin/membership-types/mt-1');
    expect(urls).toContain('/api/orgadmin/form-submissions/sub-1');
  });

  it('shows the member’s answers', async () => {
    await renderPage();
    await loaded();

    expect(screen.getByText('Aoife')).toBeInTheDocument();
    expect(screen.getByText('Byrne')).toBeInTheDocument();
  });

  it('asks for nothing extra when a member has no type or answers recorded', async () => {
    respond({ member: { ...MEMBER, membershipTypeId: null, formSubmissionId: null } });

    await renderPage();
    await loaded();

    // Requesting `/membership-types/null` 404s and takes the page down with it.
    const urls = execute.mock.calls.map(([r]) => r.url);
    expect(urls.some((u: string) => u.includes('null'))).toBe(false);
  });

  it('says the load failed rather than showing an empty member', async () => {
    execute.mockRejectedValue(new Error('network down'));

    await renderPage();

    expect(await screen.findByText(/failed/i)).toBeInTheDocument();
  });
});

describe('MemberDetailsPage — changing the status', () => {
  it('writes the new status straight away', async () => {
    await renderPage();
    await loaded();

    chooseStatus('elapsed');

    await waitFor(() =>
      expect(patches()[0]).toMatchObject({
        url: '/api/orgadmin/members/mem-1',
        data: { status: 'elapsed' },
      })
    );
  });

  it('shows the new status once it has been written', async () => {
    respond({ updated: { ...MEMBER, status: 'elapsed' } });
    await renderPage();
    await loaded();

    chooseStatus('elapsed');

    await waitFor(() => expect(statusSelect()).toHaveTextContent(/elapsed/i));
  });

  it('shows the change even when the server answers with nothing', async () => {
    respond({ updated: null });
    await renderPage();
    await loaded();

    chooseStatus('elapsed');

    // A 204 is still a success; reverting the display would look like a failure.
    await waitFor(() => expect(statusSelect()).toHaveTextContent(/elapsed/i));
  });

  it('does not claim a change the server refused', async () => {
    await renderPage();
    await loaded();
    execute.mockRejectedValue(new Error('not permitted'));

    chooseStatus('elapsed');

    // Leaving "elapsed" on screen tells the club a lapsed member was recorded.
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(statusSelect()).toHaveTextContent(/active/i);
  });
});

describe('MemberDetailsPage — marking a member processed', () => {
  it('writes the flag as turned on', async () => {
    await renderPage();
    await loaded();

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() =>
      expect(patches()[0]).toMatchObject({ data: { processed: true } })
    );
  });

  it('turns it back off again', async () => {
    respond({ member: { ...MEMBER, processed: true } });
    await renderPage();
    await loaded();

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(patches()[0]).toMatchObject({ data: { processed: false } }));
  });

  it('leaves the switch alone when the write was refused', async () => {
    await renderPage();
    await loaded();
    execute.mockRejectedValue(new Error('not permitted'));

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
});

describe('MemberDetailsPage — files a member uploaded', () => {
  const withFile = () =>
    respond({
      submission: {
        id: 'sub-1',
        submissionData: {
          proof: [{ fileId: 'file-1', fileName: 'proof-of-age.pdf' }],
        },
      },
    });

  it('asks for a fresh signed URL at the moment the file is opened', async () => {
    withFile();
    await renderPage();
    await loaded();
    vi.spyOn(window, 'open').mockImplementation(() => null);

    fireEvent.click(screen.getByText('proof-of-age.pdf'));

    // Printing a URL up front hands out a link that has already expired.
    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith({ method: 'GET', url: '/api/orgadmin/files/file-1' })
    );
  });

  it('opens the file the server pointed at', async () => {
    withFile();
    await renderPage();
    await loaded();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    fireEvent.click(screen.getByText('proof-of-age.pdf'));

    await waitFor(() => expect(open).toHaveBeenCalledWith('https://files/signed-url', '_blank'));
  });

  it('opens nothing when the server gave no URL back', async () => {
    withFile();
    execute.mockImplementation(async ({ url, method }: { url: string; method: string }) => {
      if (url.includes('/files/')) return {};
      if (method === 'GET' && url.includes('/members/')) return MEMBER;
      if (url.includes('/membership-types/')) return TYPE;
      if (url.includes('/form-submissions/'))
        return { id: 'sub-1', submissionData: { proof: [{ fileId: 'file-1', fileName: 'proof-of-age.pdf' }] } };
      return null;
    });
    await renderPage();
    await loaded();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    fireEvent.click(screen.getByText('proof-of-age.pdf'));

    // `window.open(undefined)` opens a blank tab, which reads as a broken file.
    await waitFor(() => expect(execute).toHaveBeenCalled());
    expect(open).not.toHaveBeenCalled();
  });

  it('stays usable when the file cannot be fetched', async () => {
    withFile();
    await renderPage();
    await loaded();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    execute.mockRejectedValue(new Error('file gone'));

    fireEvent.click(screen.getByText('proof-of-age.pdf'));

    await waitFor(() => expect(open).not.toHaveBeenCalled());
    expect(screen.getByText('M-0042')).toBeInTheDocument();
  });

  it('names a legacy file without offering a download it cannot produce', async () => {
    respond({
      submission: {
        id: 'sub-1',
        submissionData: { proof: [{ fileName: 'old-scan.pdf' }] },
      },
    });
    await renderPage();
    await loaded();

    expect(screen.getByText('old-scan.pdf')).toBeInTheDocument();
  });
});

describe('MemberDetailsPage — moving on', () => {
  it('goes back to the members list', async () => {
    await renderPage();
    await loaded();

    const back = within(screen.getByText('M-0042').closest('div')!.ownerDocument.body)
      .getAllByRole('button')
      .find((b) => b.querySelector('[data-testid="ArrowBackIcon"]'))!;
    fireEvent.click(back);

    expect(navigate).toHaveBeenCalledWith('/members');
  });

  it('opens this member for editing', async () => {
    await renderPage();
    await loaded();

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(navigate).toHaveBeenCalledWith('/members/mem-1/edit');
  });
});
