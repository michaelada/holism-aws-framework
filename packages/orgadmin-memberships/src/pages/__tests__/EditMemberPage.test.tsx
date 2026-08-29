import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { MemoryRouter } from 'react-router-dom';
import EditMemberPage from '../EditMemberPage';

/**
 * Editing a member who has already joined.
 *
 * This screen assembles itself from four requests — the member, their
 * membership type, the application form behind that type, and the answers they
 * gave — and each one can fail. Which of those failed changes what the operator
 * should do, so the page separates "we could not reach the server" (worth
 * retrying) from "this member does not exist" (not).
 *
 * Saving is two writes, not one: the answers go to the form submission, the
 * status, labels and membership number go to the member. Skipping either leaves
 * the club with a member whose record and answers disagree — and a duplicate
 * membership number, which the server rejects, has to come back as something an
 * operator can act on rather than a raw server string.
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

const MEMBERSHIP_TYPE = { id: 'mt-1', name: 'Senior Member', membershipFormId: 'form-1' };

const FORM = {
  id: 'form-1',
  name: 'Membership Application',
  fields: [
    { id: 'f-1', name: 'first_name', label: 'First Name', datatype: 'text', validation: { required: true } },
    { id: 'f-2', name: 'email', label: 'Email', datatype: 'email', validation: {} },
  ],
};

const SUBMISSION = {
  id: 'sub-1',
  submissionData: { first_name: 'Aoife', email: 'aoife@example.com' },
};

/** Answer the page's four loading requests, with any of them overridden. */
const respond = (over: Record<string, unknown> = {}) =>
  execute.mockImplementation(async ({ url, method }: { url: string; method: string }) => {
    if (method !== 'GET') return over.saved ?? {};
    if (url.includes('/members/')) return 'member' in over ? over.member : MEMBER;
    if (url.includes('/membership-types/')) return 'type' in over ? over.type : MEMBERSHIP_TYPE;
    if (url.includes('/application-forms/')) return 'form' in over ? over.form : FORM;
    if (url.includes('/form-submissions/')) return 'submission' in over ? over.submission : SUBMISSION;
    return {};
  });

const renderPage = async () => {
  renderWithI18n(
    <MemoryRouter>
      <EditMemberPage />
    </MemoryRouter>
  );
  await waitFor(() => expect(execute).toHaveBeenCalled());
};

const loaded = () => screen.findByDisplayValue('M-0042');

const membershipNumber = () => screen.getByDisplayValue('M-0042');

/** The write of a given kind, if the page made one. */
const writeTo = (fragment: string) =>
  execute.mock.calls.map(([r]) => r).find((r) => r.method === 'PATCH' && r.url.includes(fragment));

const anyWrite = () => execute.mock.calls.map(([r]) => r).find((r) => r.method === 'PATCH');

const save = () => fireEvent.click(screen.getByRole('button', { name: /update member/i }));

const alertText = async () => (await screen.findByRole('alert')).textContent ?? '';

beforeEach(() => {
  vi.clearAllMocks();
  params.current = { id: 'mem-1' };
  respond();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EditMemberPage — assembling the member', () => {
  it('reads the member, their type, the form behind it and their answers', async () => {
    await renderPage();
    await loaded();

    const urls = execute.mock.calls.map(([r]) => r.url);
    expect(urls).toContain('/api/orgadmin/members/mem-1');
    expect(urls).toContain('/api/orgadmin/membership-types/mt-1');
    expect(urls).toContain('/api/orgadmin/application-forms/form-1/with-fields');
    expect(urls).toContain('/api/orgadmin/form-submissions/sub-1');
  });

  it('shows the member’s existing answers rather than a blank form', async () => {
    await renderPage();
    await loaded();

    // An operator correcting one field must not have to retype the rest.
    expect(screen.getByDisplayValue('Aoife')).toBeInTheDocument();
    expect(screen.getByDisplayValue('aoife@example.com')).toBeInTheDocument();
  });

  it('shows the labels already on the member', async () => {
    await renderPage();
    await loaded();

    expect(screen.getByText('committee')).toBeInTheDocument();
  });
});

describe('EditMemberPage — when it cannot be assembled', () => {
  it('says the member was not found', async () => {
    respond({ member: null });

    await renderPage();

    expect(await alertText()).toMatch(/not found/i);
  });

  it('says so when the membership type behind the member is missing', async () => {
    respond({ type: null });

    await renderPage();

    // Silently rendering an empty form would let an operator save over answers.
    expect(await alertText()).toMatch(/not found/i);
  });

  it('says so when the form definition is missing', async () => {
    respond({ form: null });

    await renderPage();

    expect(await alertText()).toMatch(/not found/i);
  });

  it('says so when the answers themselves are missing', async () => {
    respond({ submission: null });

    await renderPage();

    expect(await alertText()).toMatch(/not found/i);
  });

  it('treats a connection failure as its own kind of problem, with a retry', async () => {
    execute.mockRejectedValue(new Error('network timeout'));

    await renderPage();
    await screen.findByRole('alert');

    // A retry on a 404 is a pointless loop; on a dropped connection it is the fix.
    expect(screen.getByRole('button', { name: /retry|try again/i })).toBeInTheDocument();
  });

  it('asks for everything again when the operator retries', async () => {
    execute.mockRejectedValue(new Error('network timeout'));
    await renderPage();
    await screen.findByRole('alert');
    const before = execute.mock.calls.length;

    respond();
    fireEvent.click(screen.getByRole('button', { name: /retry|try again/i }));

    await waitFor(() => expect(execute.mock.calls.length).toBeGreaterThan(before));
  });
});

describe('EditMemberPage — what it refuses to save', () => {
  it('refuses a member with no membership number', async () => {
    await renderPage();
    await loaded();

    fireEvent.change(membershipNumber(), { target: { value: '' } });
    save();

    // The number is how a club finds this member again; blank is not a value.
    await waitFor(() => expect(anyWrite()).toBeUndefined());
  });

  it('refuses a membership number of nothing but spaces', async () => {
    await renderPage();
    await loaded();

    fireEvent.change(membershipNumber(), { target: { value: '   ' } });
    save();

    await waitFor(() => expect(anyWrite()).toBeUndefined());
  });

  it('refuses a required answer that has been emptied', async () => {
    await renderPage();
    await loaded();

    fireEvent.change(screen.getByDisplayValue('Aoife'), { target: { value: '' } });
    save();

    await waitFor(() => expect(anyWrite()).toBeUndefined());
  });

  it('refuses an email that could never receive a renewal notice', async () => {
    await renderPage();
    await loaded();

    fireEvent.change(screen.getByDisplayValue('aoife@example.com'), {
      target: { value: 'not-an-address' },
    });
    save();

    await waitFor(() => expect(anyWrite()).toBeUndefined());
  });

  it('accepts an empty optional answer', async () => {
    await renderPage();
    await loaded();

    fireEvent.change(screen.getByDisplayValue('aoife@example.com'), { target: { value: '' } });
    save();

    // Only required fields block a save; an optional blank is a real answer.
    await waitFor(() => expect(anyWrite()).toBeDefined());
  });
});

describe('EditMemberPage — saving', () => {
  it('writes the answers and the member record, not just one of them', async () => {
    await renderPage();
    await loaded();

    fireEvent.change(screen.getByDisplayValue('Aoife'), { target: { value: 'Aoife Marie' } });
    save();

    await waitFor(() => expect(writeTo('/form-submissions/sub-1')).toBeDefined());
    expect(writeTo('/form-submissions/sub-1')!.data.submissionData).toMatchObject({
      first_name: 'Aoife Marie',
    });
    // Writing one without the other leaves record and answers disagreeing.
    await waitFor(() => expect(writeTo('/members/mem-1')).toBeDefined());
  });

  it('carries the status, labels and number onto the member record', async () => {
    await renderPage();
    await loaded();

    fireEvent.change(membershipNumber(), { target: { value: 'M-0099' } });
    save();

    await waitFor(() => expect(writeTo('/members/mem-1')).toBeDefined());
    expect(writeTo('/members/mem-1')!.data).toMatchObject({
      membershipNumber: 'M-0099',
      status: 'active',
      labels: ['committee'],
    });
  });

  it('returns to the member with something to show for it', async () => {
    await renderPage();
    await loaded();

    save();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/members/mem-1', expect.any(Object)));
  });

  it('explains a membership number that is already in use', async () => {
    await renderPage();
    await loaded();
    execute.mockRejectedValue(new Error('Membership number already exists'));

    save();

    // "duplicate key value violates unique constraint" helps nobody.
    expect(await alertText()).toMatch(/already exists|different number/i);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('offers a retry when the save never reached the server', async () => {
    await renderPage();
    await loaded();
    execute.mockRejectedValue(new Error('network timeout'));

    save();

    await screen.findByRole('alert');
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('EditMemberPage — labels', () => {
  const addLabelBox = () => screen.getByLabelText(/add label/i);

  const addLabel = (label: string) => {
    fireEvent.change(addLabelBox(), { target: { value: label } });
    fireEvent.click(screen.getAllByRole('button').find((b) => /^add$/i.test(b.textContent ?? ''))!);
  };

  it('adds a label to the member', async () => {
    await renderPage();
    await loaded();

    addLabel('life');

    expect(screen.getByText('life')).toBeInTheDocument();
  });

  it('clears the box so the next label starts empty', async () => {
    await renderPage();
    await loaded();

    addLabel('life');

    expect(addLabelBox()).toHaveValue('');
  });

  it('does not add the same label twice', async () => {
    await renderPage();
    await loaded();

    addLabel('committee');

    // It is already on the member; a second chip is indistinguishable noise.
    expect(screen.getAllByText('committee')).toHaveLength(1);
  });

  it('ignores an empty label', async () => {
    await renderPage();
    await loaded();

    addLabel('   ');
    save();

    await waitFor(() => expect(writeTo('/members/mem-1')).toBeDefined());
    expect(writeTo('/members/mem-1')!.data.labels).toEqual(['committee']);
  });

  it('removes a label and saves it as removed', async () => {
    await renderPage();
    await loaded();

    const chip = screen.getByText('committee').closest('.MuiChip-root') as HTMLElement;
    fireEvent.click(chip.querySelector('.MuiChip-deleteIcon')!);
    save();

    await waitFor(() => expect(writeTo('/members/mem-1')).toBeDefined());
    expect(writeTo('/members/mem-1')!.data.labels).toEqual([]);
  });
});

describe('EditMemberPage — leaving', () => {
  it('goes back to the member without saving', async () => {
    await renderPage();
    await loaded();

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(anyWrite()).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith('/members/mem-1');
  });

  it('changes the member’s status', async () => {
    await renderPage();
    await loaded();

    fireEvent.mouseDown(screen.getByRole('combobox', { name: /status/i }));
    const listbox = screen.getByRole('listbox');
    fireEvent.click(listbox.querySelector('[data-value="elapsed"]')!);
    save();

    // A membership that has run out is the one status change a club makes most.
    await waitFor(() => expect(writeTo('/members/mem-1')).toBeDefined());
    expect(writeTo('/members/mem-1')!.data.status).toBe('elapsed');
  });
});
