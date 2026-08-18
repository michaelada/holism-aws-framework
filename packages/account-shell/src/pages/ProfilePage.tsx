import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { formatDisplayDate } from '@aws-web-framework/components';
import { useAccountApi } from '../hooks/useAccountApi';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { changeLocale, localeForLanguage } from '../i18n/config';
import { AccountProfile } from '../types/account';
import { ChangePasswordDialog } from '../components/ChangePasswordDialog';
import { ChangeEmailDialog } from '../components/ChangeEmailDialog';

/**
 * P1 — Profile & Settings. Route `/:orgCode/profile`.
 *
 * **These details belong to the person, not to the club.** One identity spans
 * every organisation a member belongs to, so an edit here changes their name at
 * the tennis club and the pony club alike. The screen says so whenever there is
 * more than one, because a member correcting their mobile for one club would
 * otherwise be surprised.
 *
 * **Email and password are changed here too**, in dialogs (P4, P5), with
 * Keycloak updated underneath. Both used to hand off to Keycloak's account
 * console; being thrown onto a differently-branded site mid-task is
 * disorienting, and the interstitial that warned about it was a symptom rather
 * than a fix.
 *
 * What the console was doing for us still has to happen, and does — the current
 * password is verified before either change, and a new address is proved by a
 * link sent to it before it replaces the one the member signs in with.
 * See docs/ACCOUNT_SELF_SERVICE_CREDENTIALS.md.
 */

const LANGUAGES = [
  { value: 'en-GB', labelKey: 'profile.languages.en-GB' },
  { value: 'de-DE', labelKey: 'profile.languages.de-DE' },
  { value: 'es-ES', labelKey: 'profile.languages.es-ES' },
  { value: 'fr-FR', labelKey: 'profile.languages.fr-FR' },
  { value: 'it-IT', labelKey: 'profile.languages.it-IT' },
  { value: 'pt-PT', labelKey: 'profile.languages.pt-PT' },
];

export const ProfilePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { orgCode, me } = useAccountOrganisation();
  const { execute } = useAccountApi<AccountProfile>();

  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  /** '' is "follow the organisation" — the API's null. */
  const [language, setLanguage] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [changing, setChanging] = useState<null | 'password' | 'email'>(null);

  const locale = i18n.language;

  const apply = useCallback((next: AccountProfile) => {
    setProfile(next);
    setFirstName(next.firstName ?? '');
    setLastName(next.lastName ?? '');
    setPhone(next.phone ?? '');
    setLanguage(next.preferredLanguage ?? '');
  }, []);

  const load = useCallback(async () => {
    if (!orgCode) return;
    setLoading(true);
    setError(null);
    try {
      const next = await execute({ url: `/api/account/${orgCode}/profile` });
      if (next) apply(next);
    } catch {
      setError(t('profile.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [orgCode, execute, apply, t]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!orgCode) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const next = await execute({
        method: 'PUT',
        url: `/api/account/${orgCode}/profile`,
        data: {
          firstName,
          lastName,
          phone: phone.trim() ? phone.trim() : null,
          preferredLanguage: language || null,
        },
      });

      if (next) {
        apply(next);
        /*
         * Apply the language immediately rather than on the next load. A member
         * who has just chosen French and is still looking at English has no way
         * to tell whether the setting took.
         */
        await changeLocale(
          localeForLanguage(next.preferredLanguage ?? me?.organisation.language ?? 'en-GB')
        );
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile.saveFailed'));
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      <Typography variant="h5" gutterBottom>
        {t('profile.title')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {saved && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t('profile.saved')}
        </Alert>
      )}

      {(profile?.organisationCount ?? 1) > 1 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('profile.sharedAcrossOrganisations', { count: profile?.organisationCount })}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          {t('profile.sections.details')}
        </Typography>

        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              required
              label={t('profile.fields.firstName')}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              required
              label={t('profile.fields.lastName')}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label={t('profile.fields.phone')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              select
              fullWidth
              label={t('profile.fields.language')}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              helperText={t('profile.fields.languageHelper')}
            >
              <MenuItem value="">{t('profile.languages.organisationDefault')}</MenuItem>
              {LANGUAGES.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button variant="contained" onClick={save} disabled={saving}>
            {saving ? t('profile.saving') : t('profile.save')}
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          {t('profile.sections.signIn')}
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          {t('profile.signInBlurb')}
        </Typography>

        <Stack spacing={2}>
          <TextField
            fullWidth
            disabled
            label={t('profile.fields.email')}
            value={profile?.email ?? ''}
            helperText={t('profile.fields.emailHelper')}
          />
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Button variant="outlined" onClick={() => setChanging('password')}>
              {t('profile.changePassword')}
            </Button>
            <Button variant="outlined" onClick={() => setChanging('email')}>
              {t('profile.changeEmail')}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          {t('profile.sections.membership')}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            {t('profile.memberSince', {
              when: profile ? formatDisplayDate(profile.memberSince, locale) : '',
            })}
          </Typography>
          {profile?.lastLogin && (
            <Typography variant="body2" color="text.secondary">
              {t('profile.lastSignIn', {
                when: formatDisplayDate(profile.lastLogin, locale),
              })}
            </Typography>
          )}
        </Stack>
      </Paper>

      {/*
        P4 and P5. Dialogs rather than pages: both are short, both are finished
        in one go, and the member is on this screen precisely because they came
        to change something.
      */}
      {/* Gated on `orgCode` like every other call on this page: the endpoints
          are organisation-scoped even though the change is not. */}
      <ChangePasswordDialog
        open={changing === 'password' && Boolean(orgCode)}
        orgCode={orgCode ?? ''}
        onClose={() => setChanging(null)}
        onChanged={() => {
          setChanging(null);
          setSaved(true);
        }}
      />
      <ChangeEmailDialog
        open={changing === 'email' && Boolean(orgCode)}
        orgCode={orgCode ?? ''}
        currentEmail={profile?.email ?? ''}
        onClose={() => setChanging(null)}
      />
    </Container>
  );
};

export default ProfilePage;
