import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EditEventTypeTemplatePage } from '../EditEventTypeTemplatePage';

/**
 * Defining a discipline.
 *
 * Three things here are decisions rather than fields, and each is a way to
 * damage every club at once:
 *
 *  - **The key** is what a saved schedule, score sheet and result all name, so
 *    it is editable while the template is a draft and never after.
 *  - **Publishing** reveals the template to every club whose capabilities
 *    include it, so it is its own act with its own confirmation — and is
 *    refused while there are no phases, because a template with none hands a
 *    club a scheduler with nothing to schedule.
 *  - **An empty capability** means "any club with scheduling", which is a null
 *    and not an empty string. Sent as `""` it would match nothing and hide the
 *    template from everybody.
 */

const { api, navigate, showSuccess } = vi.hoisted(() => ({
  api: {
    getEventTypeTemplate: vi.fn(),
    createEventTypeTemplate: vi.fn(),
    updateEventTypeTemplate: vi.fn(),
  },
  navigate: vi.fn(),
  showSuccess: vi.fn(),
}));

let params: Record<string, string | undefined> = {};

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
  useParams: () => params,
}));

vi.mock('../../services/eventTemplateApi', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...api,
}));

vi.mock('../../context/NotificationContext', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNotification: () => ({ showSuccess, showError: vi.fn(), showInfo: vi.fn() }),
}));

const template = (over: Record<string, unknown> = {}) => ({
  id: 'tpl-1',
  key: 'equestrian.eventing',
  displayName: 'Eventing',
  description: null,
  capability: 'equestrian-disciplines',
  schedulerKind: 'sequential-phases',
  shape: {
    phases: [
      { key: 'dressage', name: 'Dressage', resourceKind: 'arena' },
      { key: 'xc', name: 'Cross country', resourceKind: 'course' },
    ],
    phaseOrder: 'strict',
    clubMayReorder: true,
    resourceKinds: [
      { key: 'arena', defaultLabel: 'Arena' },
      { key: 'course', defaultLabel: 'Course' },
    ],
    entity: { mode: 'registration-then-field', label: 'Horse' },
    settingLabels: {},
  },
  defaultSettings: { 'minutesPerCompetitor.dressage': 8, objectionsWindow: 30 },
  status: 'published',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...over,
});

/**
 * The template's own key field.
 *
 * Anchored, because three fields on this page are called Key — the template's,
 * each phase's and each resource kind's — and an unanchored `/key/` matches all
 * of them. The trailing `*` is the required marker MUI puts in the label.
 */
const identityKeyField = () => screen.getByRole('textbox', { name: /^key\s*\*?$/i });

const renderPage = () =>
  render(
    <MemoryRouter>
      <EditEventTypeTemplatePage />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  params = { id: 'tpl-1' };
  api.getEventTypeTemplate.mockResolvedValue(template());
  api.updateEventTypeTemplate.mockImplementation(async (_id: string, body: any) =>
    template({ ...body, status: body.status ?? 'published' })
  );
  api.createEventTypeTemplate.mockResolvedValue(template({ id: 'tpl-new', status: 'draft' }));
});

describe('the key', () => {
  it('cannot be edited once the template is published, and says why', async () => {
    renderPage();

    await screen.findByDisplayValue('Eventing');
    expect(identityKeyField()).toBeDisabled();
    expect(screen.getByText(/events already reference it/i)).toBeInTheDocument();
  });

  it('can be corrected while the template is a draft', async () => {
    // There is no delete endpoint, so a typo in a draft would otherwise be
    // permanent.
    api.getEventTypeTemplate.mockResolvedValue(template({ status: 'draft' }));
    renderPage();

    await screen.findByDisplayValue('Eventing');
    expect(identityKeyField()).not.toBeDisabled();
  });
});

describe('publishing', () => {
  it('is not offered on a template that is already published', async () => {
    renderPage();
    await screen.findByDisplayValue('Eventing');

    expect(screen.queryByRole('button', { name: /^publish$/i })).not.toBeInTheDocument();
  });

  it('is refused while the template has no phases', async () => {
    // A scheduler with nothing to schedule.
    api.getEventTypeTemplate.mockResolvedValue(
      template({ status: 'draft', shape: { phases: [] } })
    );
    renderPage();

    expect(await screen.findByRole('button', { name: /^publish$/i })).toBeDisabled();
  });

  it('asks first, and says what publishing means', async () => {
    api.getEventTypeTemplate.mockResolvedValue(template({ status: 'draft' }));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /^publish$/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/key can no longer be changed/i)).toBeInTheDocument();
    expect(api.updateEventTypeTemplate).not.toHaveBeenCalled();
  });

  it('sends the status only once confirmed', async () => {
    api.getEventTypeTemplate.mockResolvedValue(template({ status: 'draft' }));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /^publish$/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^publish$/i }));

    await waitFor(() => expect(api.updateEventTypeTemplate).toHaveBeenCalled());
    expect(api.updateEventTypeTemplate.mock.calls[0][1].status).toBe('published');
  });
});

describe('saving', () => {
  it('sends a blank capability as null, not as an empty string', async () => {
    // `""` would match no capability at all and hide the template from every
    // club, which is the opposite of what a blank box means here.
    renderPage();

    const capability = await screen.findByLabelText(/capability/i);
    fireEvent.change(capability, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /save template/i }));

    await waitFor(() => expect(api.updateEventTypeTemplate).toHaveBeenCalled());
    expect(api.updateEventTypeTemplate.mock.calls[0][1].capability).toBeNull();
  });

  it('will not save without a key and a display name', async () => {
    api.getEventTypeTemplate.mockResolvedValue(template({ status: 'draft' }));
    renderPage();

    fireEvent.change(await screen.findByLabelText(/display name/i), { target: { value: '' } });

    expect(screen.getByRole('button', { name: /save template/i })).toBeDisabled();
  });

  it('shows the API’s own words when a save is refused', async () => {
    // A refusal names what it refused — "Failed to save" would send the
    // administrator back to guess which field was the problem.
    api.updateEventTypeTemplate.mockRejectedValue({
      response: { data: { error: 'The key of a published template cannot be changed' } },
    });
    renderPage();
    await screen.findByDisplayValue('Eventing');

    fireEvent.click(screen.getByRole('button', { name: /save template/i }));

    expect(
      await screen.findByText(/key of a published template cannot be changed/i)
    ).toBeInTheDocument();
  });

  it('creates, then moves to the new template’s own editor', async () => {
    params = {};
    renderPage();

    fireEvent.change(identityKeyField(), { target: { value: 'equestrian.dressage' } });
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Dressage' } });
    fireEvent.click(screen.getByRole('button', { name: /create template/i }));

    await waitFor(() => expect(api.createEventTypeTemplate).toHaveBeenCalled());
    expect(navigate).toHaveBeenCalledWith('/event-type-templates/tpl-new/edit', { replace: true });
  });
});

describe('the shape panel', () => {
  it('carries the sentence that prevents the support conversation', async () => {
    renderPage();

    expect(
      await screen.findByText(/a club needing different phases needs a new template/i)
    ).toBeInTheDocument();
  });

  it('reorders a phase with arrows rather than a drag', async () => {
    renderPage();
    await screen.findByDisplayValue('Eventing');

    // Cross country is second, so it can move up but not down.
    fireEvent.click(screen.getByRole('button', { name: /move cross country earlier/i }));
    fireEvent.click(screen.getByRole('button', { name: /save template/i }));

    await waitFor(() => expect(api.updateEventTypeTemplate).toHaveBeenCalled());
    const phases = api.updateEventTypeTemplate.mock.calls[0][1].shape.phases;
    expect(phases.map((phase: any) => phase.key)).toEqual(['xc', 'dressage']);
  });

  it('cannot move the first phase earlier or the last one later', async () => {
    renderPage();
    await screen.findByDisplayValue('Eventing');

    expect(screen.getByRole('button', { name: /move dressage earlier/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /move cross country later/i })).toBeDisabled();
  });

  it('refuses to remove a resource kind a phase still runs on', async () => {
    // Removing it would leave the phase pointing at a kind that is gone.
    renderPage();
    await screen.findByDisplayValue('Eventing');

    expect(screen.getByRole('button', { name: /remove arena/i })).toBeDisabled();
    expect(screen.getByText(/used by dressage/i)).toBeInTheDocument();
  });
});
