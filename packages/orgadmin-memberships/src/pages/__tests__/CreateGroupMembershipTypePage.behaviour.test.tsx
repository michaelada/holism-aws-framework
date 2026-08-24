import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { MemoryRouter } from 'react-router-dom';
import CreateGroupMembershipTypePage from '../CreateGroupMembershipTypePage';

/**
 * A membership several people join under together — a family, a syndicate, a
 * yard.
 *
 * Everything the single-type form does applies here, plus three things that
 * only exist because more than one person is involved:
 *
 *  - **the group size**, where a minimum above the maximum is a type nobody can
 *    ever apply for, and a maximum of one is not a group at all;
 *  - **the person slots**, which are rebuilt whenever the maximum changes and
 *    must keep the titles already entered rather than clearing the form;
 *  - **field configuration**, which decides for every field on the application
 *    form whether the group shares one answer or each person answers
 *    separately — get it wrong and four people share one date of birth.
 */

const { execute, navigate, params } = vi.hoisted(() => ({
  execute: vi.fn(),
  navigate: vi.fn(),
  params: { current: {} as { id?: string } },
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
    organisation: { id: 'org-1', name: 'Meath', currency: 'EUR' },
    setOrganisation: vi.fn(),
  }),
}));

vi.mock('react-quill', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="quill-editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const FORMS = [{ id: 'form-1', name: 'Family Application' }];
const FIELDS = [
  { id: 'f-1', name: 'address', label: 'Address' },
  { id: 'f-2', name: 'dob', label: 'Date of Birth' },
];
const METHODS = [
  { id: 'pay-offline', name: 'Pay Offline' },
  { id: 'stripe', name: 'Card Payment (Stripe)' },
];

const respond = (over: Record<string, unknown> = {}) =>
  execute.mockImplementation(async ({ url, method }: { url: string; method: string }) => {
    if (url.includes('with-fields')) return { fields: FIELDS };
    if (url.includes('application-forms')) return FORMS;
    if (url.includes('payment-methods')) return METHODS;
    if (url.includes('discounts')) return { discounts: [] };
    if (method === 'GET' && url.includes('membership-types/')) return over.existing ?? {};
    return over.saved ?? { id: 'mt-1' };
  });

const renderPage = async () => {
  renderWithI18n(
    <MemoryRouter>
      <CreateGroupMembershipTypePage />
    </MemoryRouter>
  );
  await waitFor(() => expect(execute).toHaveBeenCalled());
};

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const check = (label: string | RegExp) => fireEvent.click(screen.getByLabelText(label));

const combo = (name: RegExp) => screen.getByRole('combobox', { name });

const chooseForm = () => {
  fireEvent.mouseDown(combo(/Membership Form/));
  fireEvent.click(within(screen.getByRole('listbox')).getAllByRole('option')[0]);
};

const choosePaymentMethod = () => {
  fireEvent.mouseDown(combo(/Supported Payment Methods/));
  const listbox = screen.getByRole('listbox');
  fireEvent.click(within(listbox).getAllByRole('option')[0]);
  fireEvent.keyDown(listbox, { key: 'Escape' });
};

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }));

const saveRequest = () =>
  execute.mock.calls.map(([r]) => r).find((r) => r.method === 'POST' || r.method === 'PUT');

const fillValidForm = async ({
  max = '4',
  min = '2',
}: { max?: string | null; min?: string | null } = {}) => {
  type(/^Name/, 'Family Membership');
  type(/^Description/, 'Two adults and their children');
  chooseForm();
  check('Is Rolling Membership');
  type(/^Number of Months/, '12');
  type(/^Maximum Number of People/, max ?? '');
  type(/^Minimum Number of People/, min ?? '');
  choosePaymentMethod();
};

beforeEach(() => {
  vi.clearAllMocks();
  params.current = {};
  respond();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CreateGroupMembershipTypePage — how many people', () => {
  const expectRefusal = async (pattern: RegExp) => {
    save();
    // The field's own helper text repeats these words, so read the alert.
    const message = await waitFor(() => {
      const el = document.querySelector('.MuiAlert-message');
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    expect(message.textContent).toMatch(pattern);
    expect(saveRequest()).toBeUndefined();
  };

  it('refuses a group whose maximum was cleared', async () => {
    await renderPage();
    await fillValidForm({ max: null });

    await expectRefusal(/maximum number of people must be at least 2/i);
  });

  it('refuses a "group" of one', async () => {
    await renderPage();
    await fillValidForm({ max: '1', min: '1' });

    // One person is a single membership, and it prices and renews differently.
    await expectRefusal(/maximum number of people must be at least 2/i);
  });

  it('refuses a group whose minimum was cleared', async () => {
    await renderPage();
    await fillValidForm({ min: null });

    await expectRefusal(/minimum number of people must be at least 2/i);
  });

  it('refuses a minimum larger than the maximum', async () => {
    await renderPage();
    await fillValidForm({ max: '3', min: '5' });

    // Nobody could ever submit an application that satisfies both.
    await expectRefusal(/minimum number of people cannot exceed maximum/i);
  });

  it('accepts a group where the minimum equals the maximum', async () => {
    await renderPage();
    await fillValidForm({ max: '4', min: '4' });

    save();

    // A fixed-size group — a four-person syndicate — is a real arrangement.
    await waitFor(() => expect(saveRequest()).toBeDefined());
  });
});

describe('CreateGroupMembershipTypePage — the people in the group', () => {
  it('offers a slot for each person the group may hold', async () => {
    await renderPage();

    type(/^Maximum Number of People/, '3');

    await waitFor(() =>
      expect(screen.getAllByPlaceholderText(/e\.g\.|title/i).length).toBeGreaterThanOrEqual(3)
    );
  });

  it('keeps the titles already entered when the group grows', async () => {
    await renderPage();
    type(/^Maximum Number of People/, '2');
    const titleInputs = await screen.findAllByPlaceholderText(/e\.g\.|title/i);
    fireEvent.change(titleInputs[0], { target: { value: 'Primary Member' } });

    type(/^Maximum Number of People/, '4');

    // Re-typing every slot because the group grew by one is the kind of thing
    // that makes a secretary give up halfway.
    expect(await screen.findByDisplayValue('Primary Member')).toBeInTheDocument();
  });

  it('saves a title against the person it was entered for', async () => {
    await renderPage();
    await fillValidForm({ max: '2', min: '2' });
    const titleInputs = await screen.findAllByPlaceholderText(/e\.g\.|title/i);
    fireEvent.change(titleInputs[1], { target: { value: 'Second Adult' } });

    save();

    await waitFor(() => expect(saveRequest()).toBeDefined());
    expect(saveRequest()?.data.personTitles[1]).toBe('Second Adult');
    expect(saveRequest()?.data.personTitles[0]).toBe('');
  });
});

describe('CreateGroupMembershipTypePage — which answers the group shares', () => {
  it('reads the fields of the form that was chosen', async () => {
    await renderPage();

    chooseForm();

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/orgadmin/application-forms/form-1/with-fields',
      })
    );
  });

  it('starts every field as answered separately by each person', async () => {
    await renderPage();
    chooseForm();
    await waitFor(() => expect(screen.getByText('Date of Birth')).toBeInTheDocument());
    await fillValidForm();

    save();

    await waitFor(() => expect(saveRequest()).toBeDefined());
    // Sharing by default would give four people one date of birth.
    expect(saveRequest()?.data.fieldConfiguration).toEqual({ 'f-1': 'unique', 'f-2': 'unique' });
  });

  it('carries on with no field configuration when the form’s fields cannot be read', async () => {
    execute.mockImplementation(async ({ url }: { url: string }) => {
      if (url.includes('with-fields')) throw new Error('unavailable');
      if (url.includes('application-forms')) return FORMS;
      if (url.includes('payment-methods')) return METHODS;
      if (url.includes('discounts')) return { discounts: [] };
      return { id: 'mt-1' };
    });
    await renderPage();

    chooseForm();

    // The rest of the form stays usable rather than the page dying.
    expect(await screen.findByLabelText(/^Name/)).toBeInTheDocument();
  });
});

describe('CreateGroupMembershipTypePage — saving', () => {
  it('creates a group type and returns to the list', async () => {
    await renderPage();
    await fillValidForm();

    save();

    await waitFor(() => expect(saveRequest()?.method).toBe('POST'));
    expect(saveRequest()?.data).toMatchObject({
      name: 'Family Membership',
      maxPeopleInApplication: 4,
      minPeopleInApplication: 2,
    });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/members/types'));
  });

  it('keeps the form and says so when the save is refused', async () => {
    await renderPage();
    await fillValidForm();
    execute.mockRejectedValue(new Error('server said no'));

    save();

    expect(await screen.findByText(/failed to save/i)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('leaves without saving when the club cancels', async () => {
    await renderPage();
    await fillValidForm();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(saveRequest()).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith('/members/types');
  });

  it('updates an existing group type rather than creating a second one', async () => {
    params.current = { id: 'mt-9' };
    respond({
      existing: {
        id: 'mt-9',
        name: 'Family Membership',
        description: 'Two adults',
        membershipFormId: 'form-1',
        membershipStatus: 'open',
        isRollingMembership: true,
        numberOfMonths: 12,
        memberLabels: [],
        supportedPaymentMethods: ['stripe'],
        maxPeopleInApplication: 4,
        minPeopleInApplication: 2,
        personTitles: ['', '', '', ''],
        personLabels: [[], [], [], []],
        fieldConfiguration: {},
        fee: 100,
        useTermsAndConditions: false,
        membershipTypeCategory: 'group',
        discountIds: [],
      },
    });
    await renderPage();
    await screen.findByDisplayValue('Family Membership');

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(saveRequest()?.method).toBe('PUT'));
    expect(saveRequest()?.url).toBe('/api/orgadmin/membership-types/mt-9');
  });
});
