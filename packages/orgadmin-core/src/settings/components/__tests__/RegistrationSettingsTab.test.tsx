import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegistrationSettingsTab from '../RegistrationSettingsTab';
import * as useApiModule from '../../../hooks/useApi';
import { resolveTranslation } from '../../../test/i18nTestUtils';

vi.mock('../../../hooks/useApi');

// Resolved against the real en-GB bundle so assertions describe what an
// administrator actually sees.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => resolveTranslation(key, options),
    i18n: { language: 'en-GB' },
  }),
}));

const label = (key: string, options?: Record<string, unknown>) =>
  resolveTranslation(key, options);

describe('RegistrationSettingsTab (I4)', () => {
  const mockExecute = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // `mockReset` rather than relying on clearAllMocks: a queued
    // `mockResolvedValueOnce` survives clearAllMocks and leaks into the next
    // test (CLAUDE.md §3.4).
    mockExecute.mockReset();
    mockExecute.mockResolvedValue({ autoRegistration: true, notificationEmails: [] });

    vi.mocked(useApiModule.useApi).mockReturnValue({
      execute: mockExecute,
      data: null,
      error: null,
      loading: false,
      reset: vi.fn(),
    });
  });

  const settingsSwitch = () =>
    screen.getByLabelText(label('settings.registration.autoRegistration.label'));

  it('loads the current settings', async () => {
    mockExecute.mockResolvedValue({
      autoRegistration: false,
      notificationEmails: ['admin@club.ie'],
    });
    render(<RegistrationSettingsTab />);

    await waitFor(() => expect(settingsSwitch()).not.toBeChecked());
    expect(screen.getByText('admin@club.ie')).toBeInTheDocument();
  });

  it('explains what each setting actually does', async () => {
    render(<RegistrationSettingsTab />);

    // On: members are in as soon as they verify their email.
    await waitFor(() =>
      expect(
        screen.getByText(label('settings.registration.autoRegistration.onHint'))
      ).toBeInTheDocument()
    );

    fireEvent.click(settingsSwitch());

    // Off: someone has to approve them, and they wait meanwhile.
    expect(
      screen.getByText(label('settings.registration.autoRegistration.offHint'))
    ).toBeInTheDocument();
  });

  /**
   * The combination that quietly strands people: approval is required but
   * nobody is told a request has arrived, so the queue goes unread and members
   * are locked out with no explanation.
   */
  it('warns when approval is required but nobody is notified', async () => {
    mockExecute.mockResolvedValue({ autoRegistration: false, notificationEmails: [] });
    render(<RegistrationSettingsTab />);

    await waitFor(() =>
      expect(
        screen.getByText(
          label('settings.registration.notifications.approvalWithoutRecipients')
        )
      ).toBeInTheDocument()
    );
  });

  it('does not warn when auto-registration is on and nobody is notified', async () => {
    render(<RegistrationSettingsTab />);

    await waitFor(() => expect(settingsSwitch()).toBeChecked());
    // Nothing is queued for approval, so there is nothing to miss.
    expect(
      screen.queryByText(
        label('settings.registration.notifications.approvalWithoutRecipients')
      )
    ).not.toBeInTheDocument();
  });

  it('adds a notification address', async () => {
    const user = userEvent.setup();
    render(<RegistrationSettingsTab />);

    await waitFor(() => expect(settingsSwitch()).toBeChecked());
    await user.type(
      screen.getByLabelText(label('settings.registration.notifications.addLabel')),
      'sec@club.ie'
    );
    await user.click(
      screen.getByRole('button', { name: label('settings.registration.notifications.add') })
    );

    expect(screen.getByText('sec@club.ie')).toBeInTheDocument();
  });

  it('rejects an address the API would reject', async () => {
    const user = userEvent.setup();
    render(<RegistrationSettingsTab />);

    await waitFor(() => expect(settingsSwitch()).toBeChecked());
    await user.type(
      screen.getByLabelText(label('settings.registration.notifications.addLabel')),
      'not-an-email'
    );
    await user.click(
      screen.getByRole('button', { name: label('settings.registration.notifications.add') })
    );

    expect(
      screen.getByText(label('settings.registration.validation.invalidEmail'))
    ).toBeInTheDocument();
  });

  it('treats the same address in different cases as a duplicate', async () => {
    const user = userEvent.setup();
    mockExecute.mockResolvedValue({
      autoRegistration: true,
      notificationEmails: ['admin@club.ie'],
    });
    render(<RegistrationSettingsTab />);

    await waitFor(() => expect(screen.getByText('admin@club.ie')).toBeInTheDocument());
    await user.type(
      screen.getByLabelText(label('settings.registration.notifications.addLabel')),
      'ADMIN@club.ie'
    );
    await user.click(
      screen.getByRole('button', { name: label('settings.registration.notifications.add') })
    );

    // Same inbox — adding it twice would simply mail them twice.
    expect(
      screen.getByText(label('settings.registration.validation.duplicateEmail'))
    ).toBeInTheDocument();
  });

  it('removes an address', async () => {
    const user = userEvent.setup();
    mockExecute.mockResolvedValue({
      autoRegistration: true,
      notificationEmails: ['admin@club.ie'],
    });
    render(<RegistrationSettingsTab />);

    await waitFor(() => expect(screen.getByText('admin@club.ie')).toBeInTheDocument());
    await user.click(screen.getByTestId('CancelIcon'));

    expect(screen.queryByText('admin@club.ie')).not.toBeInTheDocument();
  });

  it('saves both settings together', async () => {
    const user = userEvent.setup();
    render(<RegistrationSettingsTab />);

    await waitFor(() => expect(settingsSwitch()).toBeChecked());
    fireEvent.click(settingsSwitch());
    await user.click(
      screen.getByRole('button', { name: label('common.actions.save') })
    );

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          url: '/api/orgadmin/organisation/registration-settings',
          data: { autoRegistration: false, notificationEmails: [] },
        })
      )
    );
  });

  it('reports a save failure rather than claiming success', async () => {
    const user = userEvent.setup();
    render(<RegistrationSettingsTab />);

    await waitFor(() => expect(settingsSwitch()).toBeChecked());
    mockExecute.mockRejectedValueOnce(new Error('nope'));
    await user.click(
      screen.getByRole('button', { name: label('common.actions.save') })
    );

    await waitFor(() =>
      expect(
        screen.queryByText(label('settings.registration.messages.saved'))
      ).not.toBeInTheDocument()
    );
  });

  it('reports a load failure', async () => {
    mockExecute.mockRejectedValue(new Error('offline'));
    render(<RegistrationSettingsTab />);

    await waitFor(() =>
      expect(screen.getByText('offline')).toBeInTheDocument()
    );
  });
});
