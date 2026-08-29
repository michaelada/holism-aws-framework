import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

/**
 * Registering a thing — a horse, a boat, a dog — under one of a club's
 * registration types.
 *
 * Creating one is a three-request sequence: read who is signed in, store the
 * answers as a form submission, then create the registration that points at
 * them. The order matters, and so does stopping partway: if the submission
 * comes back without an id, creating the registration anyway leaves a record
 * pointing at answers that do not exist, which no screen can then show.
 *
 * The other decision is the starting status. A type that approves
 * automatically produces an active registration; otherwise it waits as pending.
 * Getting that wrong either lets an unapproved entry compete or leaves an
 * approved one in a queue nobody is watching.
 */

const mockNavigate = vi.fn();
const mockExecute = vi.fn();
const searchParams = { current: new URLSearchParams('typeId=rt-1') };

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [searchParams.current, vi.fn()],
  useLocation: () => ({ state: null, pathname: '/registrations/create' }),
}));

vi.mock('date-fns', () => ({}));
vi.mock('date-fns/locale', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  enGB: {},
}));

vi.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: ({ label }: any) => <div data-testid={`date-picker-${label}`} />,
}));
vi.mock('@mui/x-date-pickers/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }: any) => <>{children}</>,
}));
vi.mock('@mui/x-date-pickers/AdapterDateFns', () => ({ AdapterDateFns: class {} }));

vi.mock('react-quill', () => ({
  __esModule: true,
  default: () => <div data-testid="react-quill" />,
}));

vi.mock('@aws-web-framework/orgadmin-shell', async () => ({
  ...(await import('@aws-web-framework/orgadmin-core/test/shellMock')).createShellMock(),
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  formatDate: () => '01 Jan 2026',
}));

vi.mock('@aws-web-framework/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute: mockExecute }),
  useOrganisation: () => ({ organisation: { id: 'org-1', name: 'Test Org' } }),
}));

import CreateRegistrationPage from '../CreateRegistrationPage';

const TYPE = {
  id: 'rt-1',
  name: 'Horse Registration',
  entityName: 'Horse',
  registrationFormId: 'form-1',
  automaticallyApprove: false,
};

const FORM = {
  id: 'form-1',
  name: 'Horse Registration Form',
  fields: [
    { id: 'f-1', name: 'breed', label: 'Breed', datatype: 'text', validation: { required: true } },
  ],
};

const respond = (over: Record<string, unknown> = {}) =>
  mockExecute.mockImplementation(async ({ url, method }: { url: string; method: string }) => {
    if (url.includes('/auth/me')) return 'auth' in over ? over.auth : { user: { id: 'user-1' } };
    if (method === 'POST' && url.includes('/form-submissions'))
      return 'submission' in over ? over.submission : { id: 'sub-1' };
    if (method === 'POST' && url.includes('/registrations')) return { id: 'reg-1' };
    if (url.includes('/registration-types/')) return 'type' in over ? over.type : TYPE;
    if (url.includes('/registration-types')) return over.types ?? [TYPE];
    if (url.includes('/with-fields')) return 'form' in over ? over.form : FORM;
    return null;
  });

const renderPage = async () => {
  render(<CreateRegistrationPage />);
  await waitFor(() => expect(mockExecute).toHaveBeenCalled());
};

const entityNameBox = async () => {
  const boxes = await screen.findAllByRole('textbox');
  return boxes[0];
};

const fillValidForm = async () => {
  fireEvent.change(await entityNameBox(), { target: { value: 'Thunder' } });
  const boxes = screen.getAllByRole('textbox');
  if (boxes[1]) fireEvent.change(boxes[1], { target: { value: 'Irish Sport Horse' } });
};

const submit = () =>
  fireEvent.click(
    screen.getAllByRole('button').find((b) => /save|create|submit/i.test(b.textContent ?? ''))!
  );

const posts = () => mockExecute.mock.calls.map(([r]) => r).filter((r) => r.method === 'POST');

const postTo = (fragment: string) => posts().find((r) => r.url.includes(fragment));

beforeEach(() => {
  vi.clearAllMocks();
  searchParams.current = new URLSearchParams('typeId=rt-1');
  respond();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CreateRegistrationPage — choosing what is being registered', () => {
  it('reads the registration type named in the URL, and the form behind it', async () => {
    await renderPage();
    await entityNameBox();

    const urls = mockExecute.mock.calls.map(([r]) => r.url);
    expect(urls).toContain('/api/orgadmin/registration-types/rt-1');
    expect(urls.some((u: string) => u.includes('/application-forms/form-1/with-fields'))).toBe(true);
  });

  it('skips the chooser when the club has only one type to register under', async () => {
    searchParams.current = new URLSearchParams();

    await renderPage();

    // Asking someone to choose from a list of one is a click for nothing.
    expect(await screen.findByTestId('creation-entity-name')).toBeInTheDocument();
  });

  it('offers a choice when the club has more than one type', async () => {
    searchParams.current = new URLSearchParams();
    respond({ types: [TYPE, { ...TYPE, id: 'rt-2', name: 'Boat Registration' }] });

    await renderPage();

    expect(await screen.findByTestId('type-option-rt-2')).toBeInTheDocument();
  });

  it('goes to the form once a type is chosen', async () => {
    searchParams.current = new URLSearchParams();
    respond({ types: [TYPE, { ...TYPE, id: 'rt-2', name: 'Boat Registration' }] });
    await renderPage();
    await screen.findByTestId('type-option-rt-1');

    fireEvent.click(screen.getByTestId('type-option-rt-1'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/registrations/create?typeId=rt-1',
      expect.any(Object)
    );
  });

  it('says so when the club has no registration types at all', async () => {
    searchParams.current = new URLSearchParams();
    respond({ types: [] });

    await renderPage();

    // Otherwise the page sits empty with nothing to fill in and no reason why.
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('says so when the type cannot be read', async () => {
    mockExecute.mockRejectedValue(new Error('network down'));

    render(<CreateRegistrationPage />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('still shows the form when the type has no form attached', async () => {
    respond({ type: { ...TYPE, registrationFormId: null } });

    await renderPage();

    // The entity name alone is still a registration worth recording.
    expect(await entityNameBox()).toBeInTheDocument();
  });
});

describe('CreateRegistrationPage — what it refuses to create', () => {
  it('refuses a registration with no name for the thing being registered', async () => {
    await renderPage();
    await entityNameBox();

    submit();

    // The name is how the registration is found again; blank is not a value.
    await waitFor(() => expect(postTo('/registrations')).toBeUndefined());
  });

  it('refuses a name of nothing but spaces', async () => {
    await renderPage();
    fireEvent.change(await entityNameBox(), { target: { value: '   ' } });

    submit();

    await waitFor(() => expect(postTo('/registrations')).toBeUndefined());
  });

  it('refuses a required answer left empty', async () => {
    await renderPage();
    fireEvent.change(await entityNameBox(), { target: { value: 'Thunder' } });

    submit();

    await waitFor(() => expect(postTo('/registrations')).toBeUndefined());
  });
});

describe('CreateRegistrationPage — creating the registration', () => {
  it('stores the answers before the registration that points at them', async () => {
    await renderPage();
    await fillValidForm();

    submit();

    await waitFor(() => expect(postTo('/registrations')).toBeDefined());
    const order = posts().map((r) => r.url);
    expect(order.findIndex((u) => u.includes('form-submissions'))).toBeLessThan(
      order.findIndex((u) => u.includes('/registrations'))
    );
  });

  it('records the answers against the form and the type they belong to', async () => {
    await renderPage();
    await fillValidForm();

    submit();

    await waitFor(() => expect(postTo('/form-submissions')).toBeDefined());
    expect(postTo('/form-submissions')!.data).toMatchObject({
      formId: 'form-1',
      organisationId: 'org-1',
      contextId: 'rt-1',
      submissionType: 'registration',
    });
  });

  it('leaves a registration pending when the type does not approve automatically', async () => {
    await renderPage();
    await fillValidForm();

    submit();

    await waitFor(() => expect(postTo('/registrations')).toBeDefined());
    // Marking it active would let an unapproved entry compete.
    expect(postTo('/registrations')!.data.status).toBe('pending');
  });

  it('makes it active straight away when the type approves automatically', async () => {
    respond({ type: { ...TYPE, automaticallyApprove: true } });
    await renderPage();
    await fillValidForm();

    submit();

    await waitFor(() => expect(postTo('/registrations')).toBeDefined());
    expect(postTo('/registrations')!.data.status).toBe('active');
  });

  it('links the registration to the submission that was just stored', async () => {
    await renderPage();
    await fillValidForm();

    submit();

    await waitFor(() => expect(postTo('/registrations')).toBeDefined());
    expect(postTo('/registrations')!.data.formSubmissionId).toBe('sub-1');
  });

  it('returns to the registrations list with something to show for it', async () => {
    await renderPage();
    await fillValidForm();

    submit();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/registrations', expect.any(Object))
    );
  });
});

describe('CreateRegistrationPage — when it cannot be created', () => {
  it('creates nothing when nobody could be identified as the creator', async () => {
    respond({ auth: null });
    await renderPage();
    await fillValidForm();

    submit();

    // A submission with no user attached cannot be traced back to anyone.
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(postTo('/form-submissions')).toBeUndefined();
  });

  it('stops rather than creating a registration pointing at nothing', async () => {
    respond({ submission: {} });
    await renderPage();
    await fillValidForm();

    submit();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(postTo('/registrations')).toBeUndefined();
  });

  it('stays on the form so the answers are not lost', async () => {
    await renderPage();
    await fillValidForm();
    mockExecute.mockRejectedValue(new Error('server refused'));

    submit();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(mockNavigate).not.toHaveBeenCalledWith('/registrations', expect.any(Object));
  });
});

describe('CreateRegistrationPage — leaving', () => {
  it('goes back without creating anything', async () => {
    await renderPage();
    await entityNameBox();

    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(posts()).toHaveLength(0);
    expect(mockNavigate).toHaveBeenCalledWith('/registrations', expect.any(Object));
  });
});
