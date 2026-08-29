import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import CreateFieldPage from '../CreateFieldPage';

/**
 * Defining a reusable field that forms across the product will be built from.
 *
 * The `name` is generated from the label and is what every submission is keyed
 * by ever after — it cannot be edited later without orphaning the answers
 * already stored under the old one. So the generation is the thing to pin: it
 * has to be stable, lower-case and free of anything that would make a JSON key
 * awkward, and a label with no letters or digits at all has to be refused
 * rather than producing an empty name.
 *
 * The second rule is that a chooser with no choices is useless: a select or
 * radio field saved without options renders as an empty dropdown on a form a
 * member is trying to fill in.
 *
 * The sibling suite CreateFieldPage.test.tsx inspects the source text; this one
 * renders the page and uses it.
 */

const { execute, navigate } = vi.hoisted(() => ({ execute: vi.fn(), navigate: vi.fn() }));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
}));

vi.mock('@aws-web-framework/orgadmin-shell', () => import('../../../test/orgadminShellMock'));
vi.mock('@aws-web-framework/orgadmin-shell/hooks/useTranslation', () =>
  import('../../../test/orgadminShellMock')
);
vi.mock('@aws-web-framework/orgadmin-shell/utils/currencyFormatting', () =>
  import('../../../test/orgadminShellMock')
);
vi.mock('@aws-web-framework/orgadmin-shell/utils/dateFormatting', () =>
  import('../../../test/orgadminShellMock')
);
vi.mock('@aws-web-framework/orgadmin-shell/context/LocaleContext', () =>
  import('../../../test/orgadminShellMock')
);

vi.mock('../../../hooks/useApi', () => ({
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
}));

vi.mock('../../hooks/useFilteredFieldTypes', () => ({
  useFilteredFieldTypes: () => [
    'text',
    'textarea',
    'number',
    'email',
    'date',
    'boolean',
    'select',
    'radio',
  ],
}));

const renderPage = (organisation?: null) => {
  const result = renderWithProviders(<CreateFieldPage />, organisation === null ? { organisation: null } : {});
  return result;
};

const labelBox = () => screen.getByLabelText(/fieldLabel|field label/i);

const nameIt = (label: string) => fireEvent.change(labelBox(), { target: { value: label } });

const chooseType = (type: string) => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /fieldType|field type/i }));
  fireEvent.click(screen.getByRole('listbox').querySelector(`[data-value="${type}"]`)!);
};

const addOption = (option: string) => {
  fireEvent.change(screen.getByLabelText(/addOption|add option/i), { target: { value: option } });
  fireEvent.click(screen.getAllByRole('button').find((b) => /^add$|\.add$/i.test(b.textContent ?? ''))!);
};

const submit = () =>
  fireEvent.click(screen.getAllByRole('button').find((b) => /create|save/i.test(b.textContent ?? ''))!);

/** What the page sent to the server, if it sent anything. */
const created = () => execute.mock.calls.map(([r]) => r).find((r) => r.method === 'POST');

const alertText = async () => (await screen.findByRole('alert')).textContent ?? '';

beforeEach(() => {
  vi.clearAllMocks();
  execute.mockResolvedValue({ id: 'field-1' });
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('CreateFieldPage — naming the field', () => {
  it('keys the field on a name generated from the label', async () => {
    renderPage();

    nameIt('Date of Birth');
    submit();

    await waitFor(() => expect(created()).toBeDefined());
    expect(created()!.data.name).toBe('date_of_birth');
    expect(created()!.data.label).toBe('Date of Birth');
  });

  it('strips punctuation that would make an awkward key', async () => {
    renderPage();

    nameIt("Member's Email (primary)");
    submit();

    await waitFor(() => expect(created()).toBeDefined());
    expect(created()!.data.name).toMatch(/^[a-z0-9_]+$/);
  });

  it('collapses runs of whitespace into a single separator', async () => {
    renderPage();

    nameIt('  Home   Address  ');
    submit();

    await waitFor(() => expect(created()).toBeDefined());
    expect(created()!.data.name).toBe('home_address');
  });

  it('refuses a label with nothing in it', async () => {
    renderPage();

    submit();

    expect(await alertText()).toBeTruthy();
    expect(created()).toBeUndefined();
  });

  it('refuses a label with no letters or digits to build a name from', async () => {
    renderPage();

    nameIt('!!! ???');
    submit();

    // The generated name would be empty, and every answer keyed on "".
    expect(await alertText()).toBeTruthy();
    expect(created()).toBeUndefined();
  });

  it('trims the label it stores', async () => {
    renderPage();

    nameIt('  Nickname  ');
    submit();

    await waitFor(() => expect(created()).toBeDefined());
    expect(created()!.data.label).toBe('Nickname');
  });
});

describe('CreateFieldPage — fields that offer choices', () => {
  it('refuses a select with no options', async () => {
    renderPage();

    nameIt('Shirt Size');
    chooseType('select');
    submit();

    // It would render as an empty dropdown on a form a member has to complete.
    expect(await alertText()).toBeTruthy();
    expect(created()).toBeUndefined();
  });

  it('refuses a radio group with no options', async () => {
    renderPage();

    nameIt('Preferred Contact');
    chooseType('radio');
    submit();

    expect(await alertText()).toBeTruthy();
    expect(created()).toBeUndefined();
  });

  it('sends the options that were added', async () => {
    renderPage();

    nameIt('Shirt Size');
    chooseType('select');
    addOption('Small');
    addOption('Large');
    submit();

    await waitFor(() => expect(created()).toBeDefined());
    expect(created()!.data.options).toEqual(['Small', 'Large']);
  });

  it('does not add the same option twice', async () => {
    renderPage();

    nameIt('Shirt Size');
    chooseType('select');
    addOption('Small');
    addOption('Small');
    submit();

    await waitFor(() => expect(created()).toBeDefined());
    expect(created()!.data.options).toEqual(['Small']);
  });

  it('ignores an empty option', async () => {
    renderPage();

    nameIt('Shirt Size');
    chooseType('select');
    addOption('Small');
    addOption('   ');
    submit();

    await waitFor(() => expect(created()).toBeDefined());
    expect(created()!.data.options).toEqual(['Small']);
  });

  it('removes an option added by mistake', async () => {
    renderPage();
    nameIt('Shirt Size');
    chooseType('select');
    addOption('Small');
    addOption('Smal');

    const chip = screen.getByText('Smal').closest('.MuiChip-root') as HTMLElement;
    fireEvent.click(chip.querySelector('.MuiChip-deleteIcon')!);
    submit();

    await waitFor(() => expect(created()).toBeDefined());
    expect(created()!.data.options).toEqual(['Small']);
  });

  it('sends no options at all for a field type that has none', async () => {
    renderPage();

    nameIt('Nickname');
    submit();

    // An empty array on a text field reads as "a chooser with no choices".
    await waitFor(() => expect(created()).toBeDefined());
    expect(created()!.data.options).toBeUndefined();
  });

  it('drops the options when the type is changed to one that has none', async () => {
    renderPage();
    nameIt('Shirt Size');
    chooseType('select');
    addOption('Small');

    chooseType('text');
    submit();

    // Options left behind would come back if the type were switched again.
    await waitFor(() => expect(created()).toBeDefined());
    expect(created()!.data.options).toBeUndefined();
    expect(screen.queryByText('Small')).not.toBeInTheDocument();
  });
});

describe('CreateFieldPage — the rest of the definition', () => {
  it('sends the field to the organisation in context', async () => {
    renderPage();

    nameIt('Nickname');
    submit();

    await waitFor(() => expect(created()).toBeDefined());
    expect(created()!.url).toBe('/api/orgadmin/application-fields');
    expect(created()!.data.organisationId).toBe('org-1');
  });

  it('refuses to save when no organisation is in context', async () => {
    renderPage(null);

    nameIt('Nickname');
    submit();

    // A field with no organisation belongs to every club or to none.
    expect(await alertText()).toBeTruthy();
    expect(created()).toBeUndefined();
  });

  it('records a field as sensitive when it is marked so', async () => {
    renderPage();

    nameIt('Medical Notes');
    fireEvent.click(screen.getByLabelText(/sensitive/i));
    submit();

    await waitFor(() => expect(created()).toBeDefined());
    expect(created()!.data.isSensitive).toBe(true);
  });

  it('sends no description rather than an empty one', async () => {
    renderPage();

    nameIt('Nickname');
    submit();

    await waitFor(() => expect(created()).toBeDefined());
    expect(created()!.data.description).toBeUndefined();
  });

  it('sends a description that was written', async () => {
    renderPage();

    nameIt('Nickname');
    fireEvent.change(screen.getByLabelText(/^description$/i), {
      target: { value: 'What the member prefers to be called' },
    });
    submit();

    await waitFor(() => expect(created()).toBeDefined());
    expect(created()!.data.description).toBe('What the member prefers to be called');
  });

  it('records the chosen datatype', async () => {
    renderPage();

    nameIt('Joined On');
    chooseType('date');
    submit();

    await waitFor(() => expect(created()).toBeDefined());
    expect(created()!.data.datatype).toBe('date');
  });
});

describe('CreateFieldPage — after saving', () => {
  it('returns to the field list once the field exists', async () => {
    renderPage();

    nameIt('Nickname');
    submit();

    await waitFor(() => expect(created()).toBeDefined());
    await vi.advanceTimersByTimeAsync(2000);
    expect(navigate).toHaveBeenCalledWith('/forms/fields');
  });

  it('shows the server’s own explanation of a refusal', async () => {
    renderPage();
    execute.mockRejectedValue(new Error('A field with that name already exists'));

    nameIt('Nickname');
    submit();

    expect(await alertText()).toContain('A field with that name already exists');
  });

  it('stays on the form after a failure so nothing typed is lost', async () => {
    renderPage();
    execute.mockRejectedValue(new Error('boom'));

    nameIt('Nickname');
    submit();

    await screen.findByRole('alert');
    await vi.advanceTimersByTimeAsync(2000);
    expect(navigate).not.toHaveBeenCalledWith('/forms/fields');
    expect(labelBox()).toHaveValue('Nickname');
  });

  it('leaves without saving when cancelled', async () => {
    renderPage();

    nameIt('Nickname');
    fireEvent.click(screen.getAllByRole('button').find((b) => /cancel/i.test(b.textContent ?? ''))!);

    expect(created()).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith('/forms/fields');
  });
});
