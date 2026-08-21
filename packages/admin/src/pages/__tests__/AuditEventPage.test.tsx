import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

/**
 * One audit event, in full.
 *
 * The before/after table is why the trail exists; everything else on the page
 * is context for it. So the tests here are mostly about the reading: a fee of
 * `2500` shown as `2500` invites the reader to conclude a club charges two and
 * a half thousand euro, and the question they came to answer is "was that
 * change reasonable?".
 */

const api = vi.hoisted(() => ({ getAuditEvent: vi.fn() }));
const navigate = vi.hoisted(() => vi.fn());
const params = vi.hoisted(() => ({ current: { id: 'e1' } as Record<string, string> }));

/** Captures what the page hands the shared renderer, formatter included. */
const changesProps = vi.hoisted(() => ({ current: null as any }));

vi.mock('../../services/auditApi', () => api);
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => params.current,
}));
vi.mock('../../components/PageHeader', () => ({
  PageHeader: ({ title, description }: { title: string; description?: string }) => (
    <div>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  ),
}));
vi.mock('@aws-web-framework/components', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('../../../../components/src/utils/auditLabels')),
  ...(await vi.importActual<Record<string, unknown>>(
    '../../../../components/src/components/AuditChanges/AuditChanges'
  )),
  AuditChanges: (props: any) => {
    changesProps.current = props;
    return <div data-testid="changes" />;
  },
}));

import { AuditEventPage } from '../AuditEventPage';

const event = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  occurredAt: '2026-08-21T10:10:33Z',
  actorKeycloakUserId: 'kc-1',
  actorDisplay: 'Aoife Byrne',
  actorEmail: 'admin@kildarehunt.test',
  actorUserType: 'org-admin',
  organisationId: 'org-1',
  organisationName: 'Kildare Hunt Pony Club',
  category: 'settings',
  action: 'settings.branding-updated',
  outcome: 'success',
  entityType: 'branding-settings',
  entityId: 'b1',
  entityLabel: 'Branding',
  changes: { primaryColor: { from: '#1976d2', to: '#aa0000' } },
  context: { ip: '10.0.0.1', application: 'Org Admin', sessionId: 'abcdef1234567890' },
  ...over,
});

const format = () => changesProps.current.formatValue as (f: string, v: unknown) => string;

beforeEach(() => {
  vi.clearAllMocks();
  changesProps.current = null;
  params.current = { id: 'e1' };
  api.getAuditEvent.mockResolvedValue(event());
});

describe('the event', () => {
  it('shows who, where and what', async () => {
    render(<AuditEventPage />);

    expect((await screen.findAllByText(/Aoife Byrne/))[0]).toBeInTheDocument();
    expect(screen.getByText('Kildare Hunt Pony Club')).toBeInTheDocument();
    // Twice: once in the What field, once inside the collapsed raw record.
    expect(screen.getAllByText(/branding-settings/).length).toBeGreaterThan(0);
  });

  it('shows a dash for an event that belongs to no organisation', async () => {
    // Platform-level actions are real and must not render as a blank cell.
    api.getAuditEvent.mockResolvedValue(event({ organisationName: null }));
    render(<AuditEventPage />);

    (await screen.findAllByText(/Aoife Byrne/))[0];
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('names an unattributed actor', async () => {
    api.getAuditEvent.mockResolvedValue(event({ actorDisplay: null }));
    render(<AuditEventPage />);

    expect(await screen.findByText(/unknown/)).toBeInTheDocument();
  });

  it('says so when the event is not there', async () => {
    api.getAuditEvent.mockRejectedValue(new Error('404'));
    render(<AuditEventPage />);

    expect(await screen.findByText(/could not be found/)).toBeInTheDocument();
  });

  it('shortens the session id rather than printing all of it', async () => {
    render(<AuditEventPage />);
    expect(await screen.findByText(/session abcdef12/)).toBeInTheDocument();
  });
});

describe('following the actor', () => {
  it('links to everything else that person did', async () => {
    render(<AuditEventPage />);
    fireEvent.click(await screen.findByText(/View their audit trail/));

    expect(navigate).toHaveBeenCalledWith('/audit?actor=kc-1');
  });

  it('offers no such link when the actor is unknown', async () => {
    api.getAuditEvent.mockResolvedValue(event({ actorKeycloakUserId: null }));
    render(<AuditEventPage />);

    (await screen.findAllByText(/Aoife Byrne/))[0];
    expect(screen.queryByText(/View their audit trail/)).not.toBeInTheDocument();
  });
});

describe('reading the values', () => {
  it('hands the changes to the shared renderer', async () => {
    render(<AuditEventPage />);
    await waitFor(() => expect(changesProps.current).not.toBeNull());

    expect(changesProps.current.changes).toEqual({
      primaryColor: { from: '#1976d2', to: '#aa0000' },
    });
  });

  it('shows money in minor units as money', async () => {
    /*
     * `2500` reads as two and a half thousand. The reader is judging whether a
     * fee change was reasonable, and that is the one field where the raw value
     * actively misleads.
     */
    render(<AuditEventPage />);
    await waitFor(() => expect(changesProps.current).not.toBeNull());

    expect(format()('entryFee', 2500)).toMatch(/25\.00/);
    expect(format()('totalAmount', 3000)).toMatch(/30\.00/);
  });

  it('leaves numbers that are not money alone', async () => {
    render(<AuditEventPage />);
    await waitFor(() => expect(changesProps.current).not.toBeNull());

    expect(format()('entriesLimit', 100)).toBe('100');
    expect(format()('maxFileSize', 2500)).toBe('2500');
  });

  it('renders a boolean as a word and an absent value as a dash', async () => {
    render(<AuditEventPage />);
    await waitFor(() => expect(changesProps.current).not.toBeNull());

    expect(format()('published', true)).toBe('Yes');
    expect(format()('published', false)).toBe('No');
    expect(format()('description', null)).toBe('—');
  });
});

describe('the raw record', () => {
  it('is available but not in the way', async () => {
    render(<AuditEventPage />);
    (await screen.findAllByText(/Aoife Byrne/))[0];

    // Behind a collapsed accordion: this page is for reading a change, not for
    // debugging — but the debugging session happens too.
    const summary = screen.getByText(/Raw record/);
    expect(summary).toBeInTheDocument();
    expect(summary.closest('.MuiAccordion-root')).not.toHaveClass('Mui-expanded');
  });
});
