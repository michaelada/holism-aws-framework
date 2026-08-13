/**
 * I4 — Registration settings.
 *
 * Two things a club controls about how members get in:
 *
 *  - **Auto-registration.** ON, a member is active as soon as they verify their
 *    email. OFF, an administrator has to approve them first, and until then they
 *    see the awaiting-approval screen when they sign in.
 *  - **Notification emails.** Who is told when someone registers. This matters
 *    much more when auto-registration is OFF: with nobody notified, requests sit
 *    in the queue unseen and members are left locked out with no explanation.
 *    The form says so rather than leaving the club to discover it.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../hooks/useApi';

export interface RegistrationSettings {
  autoRegistration: boolean;
  notificationEmails: string[];
}

const DEFAULTS: RegistrationSettings = {
  autoRegistration: true,
  notificationEmails: [],
};

/** Matches the backend's own check, so the form rejects what the API would. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RegistrationSettingsTab: React.FC = () => {
  const { execute } = useApi();
  const { t } = useTranslation();

  const [settings, setSettings] = useState<RegistrationSettings>(DEFAULTS);
  const [emailDraft, setEmailDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  /**
   * Held as an i18n key, not a translated string.
   *
   * `load` is a `useCallback` that the mount effect depends on, so anything in
   * its dependency array must be stable. `t` is not guaranteed to be — it is a
   * fresh function on every render under some i18n setups — and depending on it
   * re-runs the effect forever, leaving the tab spinning rather than failing
   * visibly (CLAUDE.md §3.4). Translating at render keeps `load` stable.
   */
  const [errorKey, setErrorKey] = useState<string | null>(null);
  /** A message from the API, shown in preference to the generic key above. */
  const [errorText, setErrorText] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setErrorKey(null);
      setErrorText(null);
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/organisation/registration-settings',
      });
      if (response) {
        setSettings({
          autoRegistration: response.autoRegistration ?? DEFAULTS.autoRegistration,
          notificationEmails: response.notificationEmails ?? [],
        });
      }
    } catch (err: any) {
      setErrorKey('settings.registration.messages.loadFailed');
      setErrorText(err?.message ?? null);
    } finally {
      setLoading(false);
    }
  }, [execute]);

  useEffect(() => {
    void load();
  }, [load]);

  const addEmail = () => {
    const candidate = emailDraft.trim();
    if (!candidate) return;

    if (!EMAIL_PATTERN.test(candidate)) {
      setErrorKey('settings.registration.validation.invalidEmail');
      setErrorText(null);
      return;
    }
    // Case-insensitive, because an address added twice in different cases is
    // the same inbox and would simply be mailed twice.
    if (settings.notificationEmails.some((e) => e.toLowerCase() === candidate.toLowerCase())) {
      setErrorKey('settings.registration.validation.duplicateEmail');
      setErrorText(null);
      return;
    }

    setSettings((prev) => ({
      ...prev,
      notificationEmails: [...prev.notificationEmails, candidate],
    }));
    setEmailDraft('');
    setErrorKey(null);
    setErrorText(null);
    setSuccess(false);
  };

  const removeEmail = (email: string) => {
    setSettings((prev) => ({
      ...prev,
      notificationEmails: prev.notificationEmails.filter((e) => e !== email),
    }));
    setSuccess(false);
  };

  const save = async () => {
    try {
      setSaving(true);
      setErrorKey(null);
      setErrorText(null);
      await execute({
        method: 'PUT',
        url: '/api/orgadmin/organisation/registration-settings',
        data: settings,
      });
      setSuccess(true);
    } catch (err: any) {
      setErrorKey('settings.registration.messages.saveFailed');
      setErrorText(err?.message ?? null);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress aria-label={t('common.messages.loading')} />
      </Box>
    );
  }

  /**
   * The combination that quietly strands people: approval is required, but
   * nobody is told a request has arrived.
   */
  const approvalWithNoNotification =
    !settings.autoRegistration && settings.notificationEmails.length === 0;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('settings.registration.title')}
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        {t('settings.registration.description')}
      </Typography>

      {(errorKey || errorText) && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => {
            setErrorKey(null);
            setErrorText(null);
          }}
        >
          {errorText || (errorKey ? t(errorKey) : '')}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>
          {t('settings.registration.messages.saved')}
        </Alert>
      )}

      <FormControlLabel
        control={
          <Switch
            checked={settings.autoRegistration}
            onChange={(event) => {
              setSettings((prev) => ({ ...prev, autoRegistration: event.target.checked }));
              setSuccess(false);
            }}
            inputProps={{ 'aria-label': t('settings.registration.autoRegistration.label') }}
          />
        }
        label={t('settings.registration.autoRegistration.label')}
      />
      <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
        {t(
          settings.autoRegistration
            ? 'settings.registration.autoRegistration.onHint'
            : 'settings.registration.autoRegistration.offHint'
        )}
      </Typography>

      <Divider sx={{ mb: 3 }} />

      <Typography variant="subtitle1" gutterBottom>
        {t('settings.registration.notifications.title')}
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        {t('settings.registration.notifications.description')}
      </Typography>

      {approvalWithNoNotification && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('settings.registration.notifications.approvalWithoutRecipients')}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          label={t('settings.registration.notifications.addLabel')}
          value={emailDraft}
          onChange={(event) => setEmailDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addEmail();
            }
          }}
        />
        <Button variant="outlined" onClick={addEmail}>
          {t('settings.registration.notifications.add')}
        </Button>
      </Stack>

      {settings.notificationEmails.length === 0 ? (
        <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
          {t('settings.registration.notifications.none')}
        </Typography>
      ) : (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
          {settings.notificationEmails.map((email) => (
            <Chip key={email} label={email} onDelete={() => removeEmail(email)} />
          ))}
        </Stack>
      )}

      <Button variant="contained" onClick={save} disabled={saving}>
        {saving ? t('common.messages.saving') : t('common.actions.save')}
      </Button>
    </Box>
  );
};

export default RegistrationSettingsTab;
