import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import CreateEditFieldPage from '../CreateEditFieldPage';
import { ApiError, NetworkError } from '../../api/client';

/**
 * Defining a field, which is the smallest unit every generated form is built
 * from.
 *
 * The interesting behaviour is `datatypeProperties`: the form always holds
 * options *and* a precision, but only one of them belongs on any given field.
 * Sending both means a text field carrying a numeric precision and a select
 * carrying none — configuration that is wrong in a place nobody looks, and that
 * the renderer will later act on.
 */

const { api, navigate, params } = vi.hoisted(() => ({
  api: {
    getFields: vi.fn(),
    createField: vi.fn(),
    updateField: vi.fn(),
  },
  navigate: vi.fn(),
  params: { current: {} as { fieldShortName?: string } },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
  useParams: () => params.current,
}));

vi.mock('../../context', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMetadataApi: () => api,
}));

const EXISTING = {
  shortName: 'shirt_size',
  displayName: 'Shirt Size',
  description: 'For merchandise orders',
  datatype: 'single_select',
  datatypeProperties: {
    options: [
      { value: 's', label: 'Small' },
      { value: 'm', label: 'Medium' },
    ],
  },
};

/** The payload of the most recent create or update. */
const saved = () =>
  api.createField.mock.calls.at(-1)?.[0] ?? api.updateField.mock.calls.at(-1)?.[1];

const submit = () =>
  fireEvent.submit(screen.getByLabelText(/short name/i).closest('form')!);

/** The menu lists the raw datatype strings — "number", not "Number". */
const chooseDatatype = async (label: string) => {
  fireEvent.mouseDown(screen.getByLabelText(/datatype/i));
  fireEvent.click(within(await screen.findByRole('listbox')).getByText(label));
};

beforeEach(() => {
  vi.clearAllMocks();
  params.current = {};
  api.getFields.mockResolvedValue([EXISTING]);
  api.createField.mockResolvedValue({});
  api.updateField.mockResolvedValue({});
});

describe('CreateEditFieldPage — creating', () => {
  it('opens on an empty form without fetching anything', async () => {
    render(<CreateEditFieldPage />);

    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toHaveValue(''));
    expect(api.getFields).not.toHaveBeenCalled();
  });

  it('creates the field with what was typed', async () => {
    render(<CreateEditFieldPage />);
    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/short name/i), { target: { value: 'horse_name' } });
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Horse Name' } });
    submit();

    await waitFor(() => expect(api.createField).toHaveBeenCalled());
    expect(saved()).toEqual(
      expect.objectContaining({ shortName: 'horse_name', displayName: 'Horse Name' })
    );
  });

  it('returns to the field list once it has saved', async () => {
    render(<CreateEditFieldPage />);
    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/short name/i), { target: { value: 'horse_name' } });
    submit();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/fields'));
  });

  it('leaves without saving when Cancel is pressed', async () => {
    render(<CreateEditFieldPage />);
    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(navigate).toHaveBeenCalledWith('/fields');
    expect(api.createField).not.toHaveBeenCalled();
  });
});

describe('CreateEditFieldPage — what belongs in datatypeProperties', () => {
  it('sends neither options nor precision for a plain text field', async () => {
    render(<CreateEditFieldPage />);
    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/short name/i), { target: { value: 'notes' } });
    submit();

    await waitFor(() => expect(api.createField).toHaveBeenCalled());
    expect(saved().datatypeProperties).toEqual({});
  });

  it('sends a precision for a number field, and no options', async () => {
    render(<CreateEditFieldPage />);
    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/short name/i), { target: { value: 'height_hands' } });
    await chooseDatatype('number');
    submit();

    await waitFor(() => expect(api.createField).toHaveBeenCalled());
    expect(saved().datatypeProperties).toHaveProperty('precision');
    expect(saved().datatypeProperties.options).toBeUndefined();
  });

  it('sends options for a select field, and no precision', async () => {
    params.current = { fieldShortName: 'shirt_size' };
    render(<CreateEditFieldPage />);
    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toHaveValue('shirt_size'));

    submit();

    await waitFor(() => expect(api.updateField).toHaveBeenCalled());
    expect(saved().datatypeProperties.options).toHaveLength(2);
    expect(saved().datatypeProperties.precision).toBeUndefined();
  });

  it('always sends a validation rules array, even when empty', async () => {
    render(<CreateEditFieldPage />);
    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/short name/i), { target: { value: 'notes' } });
    submit();

    await waitFor(() => expect(api.createField).toHaveBeenCalled());
    // The renderer iterates this; `undefined` would throw at render time.
    expect(saved().validationRules).toEqual([]);
  });
});

describe('CreateEditFieldPage — the options on a select', () => {
  beforeEach(() => {
    params.current = { fieldShortName: 'shirt_size' };
  });

  it('opens with the options the field already has', async () => {
    render(<CreateEditFieldPage />);

    await waitFor(() => expect(screen.getByDisplayValue('Small')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Medium')).toBeInTheDocument();
  });

  it('adds an option', async () => {
    render(<CreateEditFieldPage />);
    await waitFor(() => expect(screen.getByDisplayValue('Small')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /add option/i }));
    submit();

    await waitFor(() => expect(api.updateField).toHaveBeenCalled());
    expect(saved().datatypeProperties.options).toHaveLength(3);
  });

  it('removes the option that was chosen, not simply the last one', async () => {
    render(<CreateEditFieldPage />);
    await waitFor(() => expect(screen.getByDisplayValue('Small')).toBeInTheDocument());

    const deleteButtons = screen
      .getAllByRole('button')
      .filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));
    fireEvent.click(deleteButtons[0]);
    submit();

    await waitFor(() => expect(api.updateField).toHaveBeenCalled());
    const options = saved().datatypeProperties.options;
    expect(options).toHaveLength(1);
    expect(options[0].label).toBe('Medium');
  });

  it('keeps an edited option label', async () => {
    render(<CreateEditFieldPage />);
    await waitFor(() => expect(screen.getByDisplayValue('Small')).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue('Small'), { target: { value: 'Extra Small' } });
    submit();

    await waitFor(() => expect(api.updateField).toHaveBeenCalled());
    expect(saved().datatypeProperties.options[0].label).toBe('Extra Small');
  });
});

describe('CreateEditFieldPage — editing', () => {
  beforeEach(() => {
    params.current = { fieldShortName: 'shirt_size' };
  });

  it('opens with the field the club already defined', async () => {
    render(<CreateEditFieldPage />);

    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toHaveValue('shirt_size'));
    expect(screen.getByLabelText(/display name/i)).toHaveValue('Shirt Size');
  });

  it('updates in place rather than creating a second field', async () => {
    render(<CreateEditFieldPage />);
    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toHaveValue('shirt_size'));

    submit();

    await waitFor(() => expect(api.updateField).toHaveBeenCalledWith('shirt_size', expect.anything()));
    expect(api.createField).not.toHaveBeenCalled();
  });

  it('says so when the field in the route does not exist', async () => {
    api.getFields.mockResolvedValue([]);

    render(<CreateEditFieldPage />);

    await waitFor(() => expect(screen.getByText(/field not found/i)).toBeInTheDocument());
  });

  it('copes with a field that has no datatypeProperties at all', async () => {
    api.getFields.mockResolvedValue([
      { shortName: 'shirt_size', displayName: 'Shirt Size', datatype: 'text' },
    ]);

    render(<CreateEditFieldPage />);

    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toHaveValue('shirt_size'));
  });
});

describe('CreateEditFieldPage — when something goes wrong', () => {
  beforeEach(() => {
    params.current = { fieldShortName: 'shirt_size' };
  });

  it('shows the API’s own message rather than a generic one', async () => {
    api.getFields.mockRejectedValue(new ApiError(409, 'CONFLICT', 'Short name already in use'));

    render(<CreateEditFieldPage />);

    await waitFor(() =>
      expect(screen.getByText(/short name already in use/i)).toBeInTheDocument()
    );
  });

  it('shows a network failure as a network failure', async () => {
    api.getFields.mockRejectedValue(new NetworkError('Unable to reach the server'));

    render(<CreateEditFieldPage />);

    await waitFor(() =>
      expect(screen.getByText(/unable to reach the server/i)).toBeInTheDocument()
    );
  });

  it('falls back to a plain message for an error it does not recognise', async () => {
    api.getFields.mockRejectedValue(new Error('kaboom'));

    render(<CreateEditFieldPage />);

    await waitFor(() =>
      expect(screen.getByText(/failed to load field definition/i)).toBeInTheDocument()
    );
  });

  it('reports a failed save and stays on the form', async () => {
    api.updateField.mockRejectedValue(new ApiError(409, 'CONFLICT', 'Field is in use'));

    render(<CreateEditFieldPage />);
    await waitFor(() => expect(screen.getByLabelText(/short name/i)).toHaveValue('shirt_size'));

    submit();

    await waitFor(() => expect(screen.getByText(/field is in use/i)).toBeInTheDocument());
    expect(navigate).not.toHaveBeenCalledWith('/fields');
  });
});
