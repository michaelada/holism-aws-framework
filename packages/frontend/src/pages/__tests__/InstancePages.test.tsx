import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ObjectInstancesPage from '../ObjectInstancesPage';
import EditInstancePage from '../EditInstancePage';
import { ApiError, NetworkError } from '../../api/client';

/**
 * The records stored against one object definition — listing them, and adding
 * or editing one.
 *
 * Both pages are driven entirely by metadata, so the risk is in the plumbing
 * rather than the fields. The list has to narrow the field catalogue to *this*
 * object's fields; handing the table every field in the repository shows a
 * member's record with columns belonging to events. And the editor decides
 * between creating and updating from whether the route carries an instance id
 * — get that wrong and editing a record silently creates a duplicate.
 *
 * The delete is confirmed, and a refusal has to reach the screen: a record that
 * looks deleted but is not is worse than one that would not delete.
 */

const { api, instances, navigate, params, tableProps, formProps, tableMounts } = vi.hoisted(() => ({
  tableMounts: { count: 0 },
  api: { getObject: vi.fn(), getFields: vi.fn() },
  instances: {
    listInstances: vi.fn(),
    deleteInstance: vi.fn(),
    createInstance: vi.fn(),
    updateInstance: vi.fn(),
  },
  navigate: vi.fn(),
  params: { current: {} as Record<string, string | undefined> },
  tableProps: { current: null as Record<string, any> | null },
  formProps: { current: null as Record<string, any> | null },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
  useParams: () => params.current,
}));

vi.mock('../../context', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMetadataApi: () => api,
  useInstancesApi: () => instances,
}));

/*
 * The table and the form are shared components with their own suites; these
 * stand-ins record what these pages hand them.
 */
vi.mock('@itsplainsailing/components', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  MetadataTable: (props: Record<string, any>) => {
    tableProps.current = props;
    // Counting mounts, because React never passes `key` through to the
    // component — remounting is the only visible sign of a refresh.
    React.useEffect(() => {
      tableMounts.count += 1;
    }, []);
    return <div data-testid="metadata-table" />;
  },
  MetadataForm: (props: Record<string, any>) => {
    formProps.current = props;
    return <div data-testid="metadata-form" />;
  },
  MetadataWizard: (props: Record<string, any>) => {
    formProps.current = props;
    return <div data-testid="metadata-wizard" />;
  },
}));

const OBJECT = {
  shortName: 'member',
  displayName: 'Member',
  description: 'A club member',
  fields: [{ fieldShortName: 'first_name' }, { fieldShortName: 'surname' }],
};

const FIELDS = [
  { shortName: 'first_name', displayName: 'First Name', datatype: 'string' },
  { shortName: 'surname', displayName: 'Surname', datatype: 'string' },
  { shortName: 'event_date', displayName: 'Event Date', datatype: 'date' },
];

const renderList = async () => {
  render(
    <MemoryRouter>
      <ObjectInstancesPage />
    </MemoryRouter>
  );
  await waitFor(() => expect(api.getObject).toHaveBeenCalled());
};

const renderEditor = async () => {
  render(
    <MemoryRouter>
      <EditInstancePage />
    </MemoryRouter>
  );
  await waitFor(() => expect(api.getObject).toHaveBeenCalled());
};

const clickButton = (pattern: RegExp) =>
  fireEvent.click(screen.getAllByRole('button').find((b) => pattern.test(b.textContent ?? ''))!);

beforeEach(() => {
  vi.clearAllMocks();
  params.current = { objectType: 'member' };
  tableProps.current = null;
  formProps.current = null;
  tableMounts.count = 0;
  api.getObject.mockResolvedValue(OBJECT);
  api.getFields.mockResolvedValue(FIELDS);
  instances.deleteInstance.mockResolvedValue(undefined);
  instances.createInstance.mockResolvedValue({ id: 'inst-9' });
  instances.updateInstance.mockResolvedValue({ id: 'inst-1' });
  vi.stubGlobal('confirm', vi.fn(() => true));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ObjectInstancesPage — listing records', () => {
  it('reads the object definition and the field catalogue together', async () => {
    await renderList();

    expect(api.getObject).toHaveBeenCalledWith('member');
    expect(api.getFields).toHaveBeenCalled();
  });

  it('shows the table for this object type', async () => {
    await renderList();

    expect(await screen.findByTestId('metadata-table')).toBeInTheDocument();
    expect(tableProps.current?.objectType).toBe('member');
  });

  it('goes back to the object list when the route names no object', async () => {
    params.current = {};

    render(
      <MemoryRouter>
        <ObjectInstancesPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/objects'));
    expect(api.getObject).not.toHaveBeenCalled();
  });

  it('says an object type does not exist rather than showing an empty table', async () => {
    api.getObject.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'No such object'));

    await renderList();

    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
  });

  it('shows the server’s own message for any other refusal', async () => {
    api.getObject.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Not permitted here'));

    await renderList();

    expect(await screen.findByText('Not permitted here')).toBeInTheDocument();
  });

  it('shows the connection message when the request never landed', async () => {
    api.getObject.mockRejectedValue(new NetworkError('Unable to connect to server'));

    await renderList();

    expect(await screen.findByText('Unable to connect to server')).toBeInTheDocument();
  });

  it('falls back to something readable for anything else', async () => {
    api.getObject.mockRejectedValue(new TypeError('x is not a function'));

    await renderList();

    expect(await screen.findByText(/failed to load/i)).toBeInTheDocument();
  });
});

describe('ObjectInstancesPage — acting on a record', () => {
  it('opens the record that was chosen for editing', async () => {
    await renderList();
    await screen.findByTestId('metadata-table');

    tableProps.current!.onEdit({ id: 'inst-7' });

    expect(navigate).toHaveBeenCalledWith('/objects/member/instances/inst-7/edit');
  });

  it('asks before deleting, and does nothing if the answer is no', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    await renderList();
    await screen.findByTestId('metadata-table');

    await tableProps.current!.onDelete({ id: 'inst-7' });

    expect(instances.deleteInstance).not.toHaveBeenCalled();
  });

  it('deletes the record that was chosen', async () => {
    await renderList();
    await screen.findByTestId('metadata-table');

    await tableProps.current!.onDelete({ id: 'inst-7' });

    expect(instances.deleteInstance).toHaveBeenCalledWith('member', 'inst-7');
  });

  it('refreshes the table so the deleted record leaves the screen', async () => {
    await renderList();
    await screen.findByTestId('metadata-table');
    const before = tableMounts.count;

    await tableProps.current!.onDelete({ id: 'inst-7' });

    await waitFor(() => expect(tableMounts.count).toBeGreaterThan(before));
  });

  it('shows the server’s reason when a delete is refused', async () => {
    await renderList();
    await screen.findByTestId('metadata-table');
    instances.deleteInstance.mockRejectedValue(
      new ApiError(409, 'IN_USE', 'Referenced by three events')
    );

    await tableProps.current!.onDelete({ id: 'inst-7' });

    // A record that looks deleted but is not is worse than one that would not.
    expect(await screen.findByText('Referenced by three events')).toBeInTheDocument();
  });

  it('reports a delete that never reached the server', async () => {
    await renderList();
    await screen.findByTestId('metadata-table');
    instances.deleteInstance.mockRejectedValue(new NetworkError('Unable to connect to server'));

    await tableProps.current!.onDelete({ id: 'inst-7' });

    expect(await screen.findByText('Unable to connect to server')).toBeInTheDocument();
  });

  it('falls back to a readable message for an unexpected delete failure', async () => {
    await renderList();
    await screen.findByTestId('metadata-table');
    instances.deleteInstance.mockRejectedValue(new TypeError('boom'));

    await tableProps.current!.onDelete({ id: 'inst-7' });

    expect(await screen.findByText(/failed to delete/i)).toBeInTheDocument();
  });

  it('starts a new record of this type', async () => {
    await renderList();
    await screen.findByTestId('metadata-table');

    clickButton(/new|add|create/i);

    expect(navigate).toHaveBeenCalledWith('/objects/member/instances/new');
  });
});

describe('EditInstancePage — creating and editing', () => {
  it('updates the record named in the route', async () => {
    params.current = { objectType: 'member', instanceId: 'inst-1' };
    await renderEditor();
    await screen.findByTestId(/metadata-(form|wizard)/);

    await formProps.current!.onSubmit({ first_name: 'Aoife' });

    expect(instances.updateInstance).toHaveBeenCalledWith('member', 'inst-1', {
      first_name: 'Aoife',
    });
    expect(instances.createInstance).not.toHaveBeenCalled();
  });

  it('creates a record when the route names none', async () => {
    params.current = { objectType: 'member' };
    await renderEditor();
    await screen.findByTestId(/metadata-(form|wizard)/);

    await formProps.current!.onSubmit({ first_name: 'Aoife' });

    // Creating here when an id was present would duplicate the record.
    expect(instances.createInstance).toHaveBeenCalledWith('member', { first_name: 'Aoife' });
    expect(instances.updateInstance).not.toHaveBeenCalled();
  });

  it('returns to the list once the record is saved', async () => {
    await renderEditor();
    await screen.findByTestId(/metadata-(form|wizard)/);

    await formProps.current!.onSubmit({ first_name: 'Aoife' });

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/objects/member/instances'));
  });

  it('shows the server’s reason and stays put when the save is refused', async () => {
    await renderEditor();
    await screen.findByTestId(/metadata-(form|wizard)/);
    instances.createInstance.mockRejectedValue(
      new ApiError(422, 'INVALID', 'Surname is required')
    );

    await expect(formProps.current!.onSubmit({ first_name: 'Aoife' })).rejects.toThrow();

    expect(await screen.findByText('Surname is required')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalledWith('/objects/member/instances');
  });

  it('re-throws so the form knows the save did not happen', async () => {
    await renderEditor();
    await screen.findByTestId(/metadata-(form|wizard)/);
    instances.createInstance.mockRejectedValue(new NetworkError('Unable to connect to server'));

    // Swallowing it here would leave the form looking saved.
    await expect(formProps.current!.onSubmit({})).rejects.toBeInstanceOf(NetworkError);
  });

  it('falls back to a readable message for an unexpected failure', async () => {
    await renderEditor();
    await screen.findByTestId(/metadata-(form|wizard)/);
    instances.createInstance.mockRejectedValue(new TypeError('boom'));

    await expect(formProps.current!.onSubmit({})).rejects.toThrow();

    expect(await screen.findByText(/failed to save/i)).toBeInTheDocument();
  });

  it('leaves without saving when cancelled', async () => {
    await renderEditor();
    await screen.findByTestId(/metadata-(form|wizard)/);

    formProps.current!.onCancel();

    expect(instances.createInstance).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/objects/member/instances');
  });

  it('goes back to the object list when the route names no object type', async () => {
    params.current = {};

    render(
      <MemoryRouter>
        <EditInstancePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/objects'));
  });

  it('says so when the object definition cannot be read', async () => {
    api.getObject.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'No such object'));

    await renderEditor();

    expect(await screen.findByText(/not found|no such object/i)).toBeInTheDocument();
  });
});
