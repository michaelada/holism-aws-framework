import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegistrationsPage from '../RegistrationsPage';
import * as useApiModule from '../../../hooks/useApi';
import { resolveTranslation } from '../../../test/i18nTestUtils';

vi.mock('../../../hooks/useApi');

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => resolveTranslation(key, options),
    i18n: { language: 'en-GB' },
  }),
}));

const label = (key: string, options?: Record<string, unknown>) =>
  resolveTranslation(key, options);

const registration = (over: Record<string, unknown> = {}) => ({
  id: 'reg-1',
  email: 'sam@example.com',
  firstName: 'Sam',
  lastName: 'Rivers',
  phone: '+353 1 234 5678',
  status: 'pending',
  registeredAt: '2026-06-01T10:00:00Z',
  ...over,
});

describe('RegistrationsPage (I3)', () => {
  const mockExecute = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // `mockReset`, because a queued `mockResolvedValueOnce` survives
    // `clearAllMocks` and leaks into the next test.
    mockExecute.mockReset();
    mockExecute.mockResolvedValue({ status: 'pending', registrations: [registration()] });

    vi.mocked(useApiModule.useApi).mockReturnValue({
      execute: mockExecute,
      data: null,
      error: null,
      loading: false,
      reset: vi.fn(),
    });
  });

  const approveButton = () =>
    screen.getAllByRole('button', { name: label('users.registrations.actions.approve') })[0];
  const rejectButton = () =>
    screen.getAllByRole('button', { name: label('users.registrations.actions.reject') })[0];

  it('lists people waiting for approval', async () => {
    render(<RegistrationsPage />);

    expect(await screen.findByText('Sam Rivers')).toBeInTheDocument();
    expect(screen.getByText('sam@example.com')).toBeInTheDocument();
  });

  it('asks for pending registrations first', async () => {
    render(<RegistrationsPage />);

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/api/orgadmin/organisation/registrations?status=pending',
        })
      )
    );
  });

  it('switches to the approved and refused lists', async () => {
    const user = userEvent.setup();
    render(<RegistrationsPage />);

    await waitFor(() => expect(screen.getByText('Sam Rivers')).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: label('users.registrations.tabs.rejected') }));

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/api/orgadmin/organisation/registrations?status=rejected',
        })
      )
    );
  });

  it('offers no approve or refuse buttons on a list of past decisions', async () => {
    const user = userEvent.setup();
    render(<RegistrationsPage />);

    await waitFor(() => expect(screen.getByText('Sam Rivers')).toBeInTheDocument());
    mockExecute.mockResolvedValue({
      status: 'active',
      registrations: [registration({ status: 'active' })],
    });
    await user.click(screen.getByRole('tab', { name: label('users.registrations.tabs.active') }));

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: label('users.registrations.actions.approve') })
      ).not.toBeInTheDocument()
    );
  });

  /**
   * Approving grants access to the club's data and refusing locks a real person
   * out. Neither should be one stray click in a dense table.
   */
  it('confirms before approving', async () => {
    const user = userEvent.setup();
    render(<RegistrationsPage />);

    await waitFor(() => expect(screen.getByText('Sam Rivers')).toBeInTheDocument());
    await user.click(approveButton());

    expect(
      screen.getByText(label('users.registrations.confirm.approveTitle'))
    ).toBeInTheDocument();
    // Nothing has been sent yet — only the list load.
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('records an approval', async () => {
    const user = userEvent.setup();
    render(<RegistrationsPage />);

    await waitFor(() => expect(screen.getByText('Sam Rivers')).toBeInTheDocument());
    await user.click(approveButton());
    await user.click(
      screen.getByRole('button', { name: label('users.registrations.actions.approve') })
    );

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/api/orgadmin/organisation/registrations/reg-1/decision',
          data: { decision: 'approve', note: undefined },
        })
      )
    );
  });

  it('records a refusal with the note the admin wrote', async () => {
    const user = userEvent.setup();
    render(<RegistrationsPage />);

    await waitFor(() => expect(screen.getByText('Sam Rivers')).toBeInTheDocument());
    await user.click(rejectButton());
    await user.type(
      screen.getByLabelText(label('users.registrations.confirm.noteLabel')),
      'Not a member of the club'
    );
    await user.click(
      screen.getByRole('button', { name: label('users.registrations.actions.reject') })
    );

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { decision: 'reject', note: 'Not a member of the club' },
        })
      )
    );
  });

  it('says plainly that the note is never shown to the member', async () => {
    const user = userEvent.setup();
    render(<RegistrationsPage />);

    await waitFor(() => expect(screen.getByText('Sam Rivers')).toBeInTheDocument());
    await user.click(rejectButton());

    // Without this an admin writes the note as though it were a message to the
    // person being refused.
    expect(
      screen.getByText(label('users.registrations.confirm.noteHint'))
    ).toBeInTheDocument();
  });

  it('can be cancelled without recording anything', async () => {
    const user = userEvent.setup();
    render(<RegistrationsPage />);

    await waitFor(() => expect(screen.getByText('Sam Rivers')).toBeInTheDocument());
    await user.click(approveButton());
    await user.click(screen.getByRole('button', { name: label('common.actions.cancel') }));

    await waitFor(() =>
      expect(
        screen.queryByText(label('users.registrations.confirm.approveTitle'))
      ).not.toBeInTheDocument()
    );
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('reloads after a decision, because the row moves to another tab', async () => {
    const user = userEvent.setup();
    render(<RegistrationsPage />);

    await waitFor(() => expect(screen.getByText('Sam Rivers')).toBeInTheDocument());
    await user.click(approveButton());
    await user.click(
      screen.getByRole('button', { name: label('users.registrations.actions.approve') })
    );

    // load, decision, load again.
    await waitFor(() => expect(mockExecute).toHaveBeenCalledTimes(3));
  });

  it('explains an empty queue', async () => {
    mockExecute.mockResolvedValue({ status: 'pending', registrations: [] });
    render(<RegistrationsPage />);

    expect(
      await screen.findByText(label('users.registrations.empty.pending'))
    ).toBeInTheDocument();
  });

  it('reports a failure to load rather than looking empty', async () => {
    mockExecute.mockRejectedValue(new Error('offline'));
    render(<RegistrationsPage />);

    expect(await screen.findByText('offline')).toBeInTheDocument();
    expect(
      screen.queryByText(label('users.registrations.empty.pending'))
    ).not.toBeInTheDocument();
  });

  it('reports a failed decision and leaves the row where it was', async () => {
    const user = userEvent.setup();
    render(<RegistrationsPage />);

    await waitFor(() => expect(screen.getByText('Sam Rivers')).toBeInTheDocument());
    await user.click(approveButton());
    mockExecute.mockRejectedValueOnce(new Error('server said no'));
    await user.click(
      screen.getByRole('button', { name: label('users.registrations.actions.approve') })
    );

    expect(await screen.findByText('server said no')).toBeInTheDocument();
    expect(screen.getByText('Sam Rivers')).toBeInTheDocument();
  });

  it('shows a dash for someone who gave no phone number', async () => {
    mockExecute.mockResolvedValue({
      status: 'pending',
      registrations: [registration({ phone: null })],
    });
    render(<RegistrationsPage />);

    await waitFor(() => expect(screen.getByText('Sam Rivers')).toBeInTheDocument());
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
