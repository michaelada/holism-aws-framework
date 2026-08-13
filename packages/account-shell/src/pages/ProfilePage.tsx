import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { formatDisplayDate } from '@aws-web-framework/components';
import { useAccountApi } from '../hooks/useAccountApi';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { useAuthContext } from '../context/AuthContext';
import { changeLocale, localeForLanguage } from '../i18n/config';
import { AccountProfile } from '../types/account';

/**
 * P1 — Profile & Settings. Route `/:orgCode/profile`.
 *
 * **These details belong to the person, not to the club.** One identity spans
 * every organisation a member belongs to, so an edit here changes their name at
 * the tennis club and the pony club alike. The screen says so whenever there is
 * more than one, because a member correcting their mobile for one club would
 * otherwise be surprised.
 *
 * **Email and password are not edited here** (P2). Both need a verification
 * flow to be safe — an unverified email change locks a member out of the
 * address they sign in with — and Keycloak's account console already implements
 * both correctly. The buttons hand off there rather than reimplementing
 * verification, with an interstitial first so leaving the app is not a surprise.
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
  const { keycloak } = useAuthContext();
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
  const [leaving, setLeaving] = useState<null | 'password' | 'email'>(null);

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

  /**
   * Keycloak's account console, with a return URL so the member comes back to
   * this page. `createAccountUrl` is used rather than a hand-built path so the
   * console gets the referrer parameters that give it a "back to application"
   * link of its own.
   */
  const openAccountConsole = () => {
    const url = keycloak?.createAccountUrl({ redirectUri: window.location.href });
    if (url) {
      window.location.assign(url);
    }
    setLeaving(null);
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
            <Button
              variant="outlined"
              endIcon={<OpenInNewIcon />}
              onClick={() => setLeaving('password')}
            >
              {t('profile.changePassword')}
            </Button>
            <Button
              variant="outlined"
              endIcon={<OpenInNewIcon />}
              onClick={() => setLeaving('email')}
            >
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
        P2 — the interstitial. Leaving the app for a different site mid-task is
        disorienting without warning, and the member needs to know they will be
        brought back.
      */}
      <Dialog open={leaving !== null} onClose={() => setLeaving(null)}>
        <DialogTitle>
          {leaving === 'email' ? t('profile.changeEmail') : t('profile.changePassword')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>{t('profile.leavingBlurb')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaving(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={openAccountConsole}>
            {t('profile.continueToAccount')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProfilePage;
