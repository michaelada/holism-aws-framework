import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EventTypeTemplatesPage } from '../EventTypeTemplatesPage';

/**
 * The disciplines the platform defines.
 *
 * A short list, rarely changed, and consequential: every club running eventing
 * runs the row called eventing. Two things have to be legible at a glance,
 * because neither is recoverable by looking at a club — whether a template is
 * still a **draft** (invisible to everybody) and which **capability** reveals
 * it. A template with no phases published by accident hands a club a scheduler
 * with nothing in it.
 */

const { api, navigate, showError } = vi.hoisted(() => ({
  api: { getEventTypeTemplates: vi.fn() },
  navigate: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
}));

vi.mock('../../services/eventTemplateApi', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...api,
}));

vi.mock('../../context/NotificationContext', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNotification: () => ({ showSuccess: vi.fn(), showError, showInfo: vi.fn() }),
}));

const template = (over: Record<string, unknown> = {}) => ({
  id: 'tpl-1',
  key: 'equestrian.eventing',
  displayName: 'Eventing',
  description: null,
  capability: 'equestrian-disciplines',
  schedulerKind: 'sequential-phases',
  shape: { phases: [{ key: 'dressage', name: 'Dressage', resourceKind: 'arena' }] },
  defaultSettings: {},
  status: 'published',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...over,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <EventTypeTemplatesPage />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  api.getEventTypeTemplates.mockResolvedValue([template()]);
});

describe('the list', () => {
  it('shows the display name with the key beneath it', async () => {
    renderPage();

    expect(await screen.findByText('Eventing')).toBeInTheDocument();
    expect(screen.getByText('equestrian.eventing')).toBeInTheDocument();
  });

  it('names the scheduler in words rather than showing its identifier', async () => {
    renderPage();

    expect(await screen.findByText('Sequential phases')).toBeInTheDocument();
  });

  it('marks a draft as a draft', async () => {
    // The one fact that cannot be discovered from a club: a draft is invisible
    // to every one of them.
    api.getEventTypeTemplates.mockResolvedValue([template({ status: 'draft' })]);
    renderPage();

    expect(await screen.findByText('Draft')).toBeInTheDocument();
  });

  it('says a template with no capability is open to any club with scheduling', async () => {
    // Not an empty cell. A null capability is a decision, and a blank would
    // read as one nobody had got round to making.
    api.getEventTypeTemplates.mockResolvedValue([template({ capability: null })]);
    renderPage();

    expect(await screen.findByText('Any club with scheduling')).toBeInTheDocument();
  });

  it('counts the phases, and says none where there are none', async () => {
    api.getEventTypeTemplates.mockResolvedValue([
      template({ id: 'tpl-2', displayName: 'Empty', shape: {} }),
    ]);
    renderPage();

    expect(await screen.findByText('None')).toBeInTheDocument();
  });
});

describe('when the list cannot be loaded', () => {
  it('says so rather than showing an empty list', async () => {
    // An empty table reads as "there are no templates" and invites somebody to
    // create a duplicate of one that already exists.
    api.getEventTypeTemplates.mockRejectedValue(new Error('network'));
    renderPage();

    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
    expect(showError).toHaveBeenCalled();
  });

  it('offers a retry that asks again', async () => {
    api.getEventTypeTemplates.mockRejectedValue(new Error('network'));
    renderPage();

    const retry = await screen.findByRole('button', { name: /try again/i });
    api.getEventTypeTemplates.mockResolvedValue([template()]);
    fireEvent.click(retry);

    await waitFor(() => expect(api.getEventTypeTemplates).toHaveBeenCalledTimes(2));
  });
});

describe('getting to the editor', () => {
  it('edits the row that was clicked, not the first row', async () => {
    // The table sorts by its columns, so "the first row" is a claim about
    // ordering this test does not mean to make (CLAUDE.md §3.4).
    api.getEventTypeTemplates.mockResolvedValue([
      template(),
      template({ id: 'tpl-2', key: 'equestrian.dressage', displayName: 'Dressage' }),
    ]);
    renderPage();

    const row = (await screen.findByText('Dressage')).closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: /edit dressage/i }));

    expect(navigate).toHaveBeenCalledWith('/event-type-templates/tpl-2/edit');
  });

  it('creates from the header button', async () => {
    renderPage();
    await screen.findByText('Eventing');

    fireEvent.click(screen.getAllByRole('button', { name: /create template/i })[0]);

    expect(navigate).toHaveBeenCalledWith('/event-type-templates/new');
  });
});
