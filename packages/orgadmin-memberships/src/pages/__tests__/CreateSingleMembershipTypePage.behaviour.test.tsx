import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { MemoryRouter } from 'react-router-dom';
import CreateSingleMembershipTypePage from '../CreateSingleMembershipTypePage';

/**
 * Defining a membership a club sells, and editing one.
 *
 * The validation is the substance of this screen, and each rule exists because
 * the thing it guards is unrecoverable once members have joined against it: a
 * type with no payment method cannot be paid for, a fixed-period type with no
 * end date never expires, and a rolling one with no month count has no term at
 * all. Saving any of those produces memberships nobody can correct afterwards
 * without touching the database.
 *
 * The second thing worth pinning is create-versus-edit: the same form saves
 * with POST or PUT depending on the route, and getting that wrong either
 * duplicates a type or overwrites the wrong one.
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

vi.mock('@itsplainsailing/orgadmin-shell', async () => {
  const { shellMock } = await import('../../test/shell-mock');
  return shellMock();
});

vi.mock('@itsplainsailing/orgadmin-core', async (importOriginal) => ({
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

const FORMS = [{ id: 'form-1', name: 'Membership Application' }];
const METHODS = [
  { id: 'pay-offline', name: 'Pay Offline' },
  { id: 'stripe', name: 'Card Payment (Stripe)' },
];

const respond = (over: Record<string, unknown> = {}) =>
  execute.mockImplementation(async ({ url, method }: { url: string; method: string }) => {
    if (url.includes('application-forms')) return FORMS;
    if (url.includes('payment-methods')) return METHODS;
    if (url.includes('discounts')) return { discounts: [] };
    if (method === 'GET' && url.includes('membership-types/')) return over.existing ?? {};
    return over.saved ?? { id: 'mt-1' };
  });

const renderPage = async () => {
  renderWithI18n(
    <MemoryRouter>
      <CreateSingleMembershipTypePage />
    </MemoryRouter>
  );
  await waitFor(() => expect(execute).toHaveBeenCalled());
};

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const check = (label: string | RegExp) => fireEvent.click(screen.getByLabelText(label));

const choosePaymentMethod = () => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /Supported Payment Methods/ }));
  const listbox = screen.getByRole('listbox');
  fireEvent.click(within(listbox).getAllByRole('option')[0]);
  // A multiple Select keeps its menu open, and its backdrop swallows every
  // later click; only Escape closes it.
  fireEvent.keyDown(listbox, { key: 'Escape' });
};

const chooseForm = () => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /Membership Form/ }));
  fireEvent.click(within(screen.getByRole('listbox')).getAllByRole('option')[0]);
};

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }));

const saveRequest = () =>
  execute.mock.calls.map(([r]) => r).find((r) => r.method === 'POST' || r.method === 'PUT');

/** Fill in everything the form insists on, leaving one gap if named. */
const fillValidForm = async ({ skip }: { skip?: string } = {}) => {
  if (skip !== 'name') type(/^Name/, 'Junior Member');
  if (skip !== 'description') type(/^Description/, 'Under 18s');
  if (skip !== 'form') chooseForm();
  if (skip !== 'rolling') {
    check('Is Rolling Membership');
    if (skip !== 'months') type(/^Number of Months/, '12');
  }
  if (skip !== 'payment') choosePaymentMethod();
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

describe('CreateSingleMembershipTypePage — arriving', () => {
  it('offers the club’s own application forms', async () => {
    await renderPage();

    expect(execute).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/orgadmin/application-forms',
    });
  });

  it('still offers a way to be paid when the payment methods cannot be read', async () => {
    execute.mockImplementation(async ({ url }: { url: string }) => {
      if (url.includes('payment-methods')) throw new Error('unavailable');
      return [];
    });

    await renderPage();

    // With no methods at all the form cannot be completed and cannot be saved.
    fireEvent.mouseDown(await screen.findByRole('combobox', { name: /Supported Payment Methods/ }));
    expect(within(screen.getByRole('listbox')).getAllByRole('option').length).toBeGreaterThan(0);
  });
});

describe('CreateSingleMembershipTypePage — what it refuses to save', () => {
  const expectRefusal = async (pattern: RegExp) => {
    save();
    expect(await screen.findByText(pattern)).toBeInTheDocument();
    expect(saveRequest()).toBeUndefined();
  };

  it('refuses a membership type with no name', async () => {
    await renderPage();
    await fillValidForm({ skip: 'name' });

    await expectRefusal(/name is required/i);
  });

  it('refuses one with no description', async () => {
    await renderPage();
    await fillValidForm({ skip: 'description' });

    await expectRefusal(/description is required/i);
  });

  it('refuses one with no application form behind it', async () => {
    await renderPage();
    await fillValidForm({ skip: 'form' });

    // Without a form there is nothing for an applicant to fill in.
    await expectRefusal(/form is required/i);
  });

  it('refuses a fixed-period membership with no end date', async () => {
    await renderPage();
    await fillValidForm({ skip: 'rolling' });

    // Otherwise the membership never expires and is never renewed.
    await expectRefusal(/valid until/i);
  });

  it('refuses a rolling membership with no term', async () => {
    await renderPage();
    await fillValidForm({ skip: 'months' });

    await expectRefusal(/number of months is required/i);
  });

  it('refuses one nobody can pay for', async () => {
    await renderPage();
    await fillValidForm({ skip: 'payment' });

    await expectRefusal(/payment method is required/i);
  });

  it('refuses to turn on terms and conditions without any text', async () => {
    await renderPage();
    await fillValidForm();
    check('Use Terms and Conditions');

    // An empty agreement is worse than none — members accept nothing.
    await expectRefusal(/terms and conditions content is required/i);
  });

  it('treats a name of nothing but spaces as no name', async () => {
    await renderPage();
    await fillValidForm();
    type(/^Name/, '   ');

    await expectRefusal(/name is required/i);
  });
});

describe('CreateSingleMembershipTypePage — saving', () => {
  it('creates the membership type and returns to the list', async () => {
    await renderPage();
    await fillValidForm();

    save();

    await waitFor(() => expect(saveRequest()?.method).toBe('POST'));
    expect(saveRequest()?.url).toBe('/api/orgadmin/membership-types');
    expect(saveRequest()?.data).toMatchObject({
      name: 'Junior Member',
      description: 'Under 18s',
      membershipTypeCategory: 'single',
      isRollingMembership: true,
      numberOfMonths: 12,
    });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/members/types'));
  });

  it('says what happened when the save is refused, and stays on the form', async () => {
    await renderPage();
    await fillValidForm();
    execute.mockRejectedValue(new Error('duplicate name'));

    save();

    expect(await screen.findByText(/failed to save/i)).toBeInTheDocument();
    // Navigating away would lose everything just typed.
    expect(navigate).not.toHaveBeenCalled();
  });

  it('leaves without saving when the club cancels', async () => {
    await renderPage();
    await fillValidForm();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(saveRequest()).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith('/members/types');
  });
});

describe('CreateSingleMembershipTypePage — editing an existing type', () => {
  beforeEach(() => {
    params.current = { id: 'mt-9' };
    respond({
      existing: {
        id: 'mt-9',
        name: 'Senior Member',
        description: 'Over 18s',
        membershipFormId: 'form-1',
        membershipStatus: 'open',
        isRollingMembership: true,
        numberOfMonths: 12,
        memberLabels: ['committee'],
        supportedPaymentMethods: ['stripe'],
        fee: 50,
        useTermsAndConditions: false,
        membershipTypeCategory: 'single',
        discountIds: [],
      },
    });
  });

  it('reads the type it was asked to edit', async () => {
    await renderPage();

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/orgadmin/membership-types/mt-9',
      })
    );
  });

  it('shows what is already there rather than a blank form', async () => {
    await renderPage();

    expect(await screen.findByDisplayValue('Senior Member')).toBeInTheDocument();
  });

  it('updates that type instead of creating another', async () => {
    await renderPage();
    await screen.findByDisplayValue('Senior Member');

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    // A POST here would leave the club with two types of the same name.
    await waitFor(() => expect(saveRequest()?.method).toBe('PUT'));
    expect(saveRequest()?.url).toBe('/api/orgadmin/membership-types/mt-9');
  });

  it('reports a load that failed rather than showing an empty form as if it were the type', async () => {
    execute.mockImplementation(async ({ url }: { url: string }) => {
      if (url.includes('membership-types/')) throw new Error('gone');
      return [];
    });

    await renderPage();

    expect(await screen.findByText(/failed to load/i)).toBeInTheDocument();
  });
});

describe('CreateSingleMembershipTypePage — member labels', () => {
  const addLabel = (label: string) => {
    fireEvent.change(screen.getByPlaceholderText('Add label'), { target: { value: label } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  };

  it('adds a label to the type', async () => {
    await renderPage();

    addLabel('committee');

    expect(screen.getByText('committee')).toBeInTheDocument();
  });

  it('clears the box so the next label starts empty', async () => {
    await renderPage();

    addLabel('committee');

    expect(screen.getByPlaceholderText('Add label')).toHaveValue('');
  });

  it('ignores an empty label', async () => {
    await renderPage();

    fireEvent.change(screen.getByPlaceholderText('Add label'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await fillValidForm();
    save();

    await waitFor(() => expect(saveRequest()).toBeDefined());
    expect(saveRequest()?.data.memberLabels).toEqual([]);
  });

  it('does not add the same label twice', async () => {
    await renderPage();

    addLabel('committee');
    addLabel('committee');

    // Duplicates show as two identical chips with no way to tell them apart.
    expect(screen.getAllByText('committee')).toHaveLength(1);
  });

  it('removes a label that was added by mistake', async () => {
    await renderPage();
    addLabel('committee');

    const chip = screen.getByText('committee').closest('.MuiChip-root') as HTMLElement;
    fireEvent.click(chip.querySelector('.MuiChip-deleteIcon')!);

    expect(screen.queryByText('committee')).not.toBeInTheDocument();
  });

  it('saves the labels that survived', async () => {
    await renderPage();
    addLabel('committee');
    addLabel('life');
    await fillValidForm();

    save();

    await waitFor(() => expect(saveRequest()).toBeDefined());
    expect(saveRequest()?.data.memberLabels).toEqual(['committee', 'life']);
  });
});
