import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useAccountApi, AccountApiError } from '../hooks/useAccountApi';

/**
 * P5 — changing an email address without leaving the app.
 *
 * **Nothing changes here.** The member's Keycloak username *is* their email
 * address, so an address that turned out to be mistyped would be a login they
 * do not own. This asks the server to send a link to the new address, and the
 * change happens only when that link is followed (P6).
 *
 * The screen says so up front rather than in a footnote, because a member who
 * closes the dialog believing the change is done will try to sign in with an
 * address that does not work yet.
 *
 * **The confirmation says nothing about whether the address was already in
 * use.** It cannot: a different answer would let anybody test which addresses
 * are registered with the platform. Whoever owns that address is told by mail.
 */

interface Props {
  open: boolean;
  orgCode: string;
  currentEmail: string;
  onClose: () => void;
}

export const ChangeEmailDialog: React.FC<Props> = ({
  open,
  orgCode,
  currentEmail,
  onClose,
}) => {
  const { t } = useTranslation();
  const { execute } = useAccountApi<{ sentTo: string }>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const reset = () => {
    setEmail('');
    setPassword('');
    setReveal(false);
    setError(null);
    setSaving(false);
    setSentTo(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const sameAsNow = email.trim().toLowerCase() === currentEmail.trim().toLowerCase();
  const submittable = email.trim().length > 0 && password.length > 0 && !sameAsNow && !saving;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!submittable) return;

    setSaving(true);
    setError(null);

    try {
      const result = await execute({
        method: 'POST',
        url: `/api/account/${orgCode}/profile/email`,
        data: { currentPassword: password, newEmail: email.trim() },
      });
      setSentTo(result?.sentTo ?? email.trim());
    } catch (err) {
      setError(
        err instanceof AccountApiError && err.message ? err.message : t('profile.email.failed')
      );
    } finally {
      setSaving(false);
    }
  };

  if (sentTo) {
    return (
      <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
        <DialogTitle>{t('profile.email.checkInbox')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1, alignItems: 'center', textAlign: 'center' }}>
            <MarkEmailUnreadIcon color="primary" sx={{ fontSize: '2.5rem' }} />
            <Typography variant="body1">{t('profile.email.sentTo', { email: sentTo })}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('profile.email.sentBlurb')}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={close}>
            {t('common.done')}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
      <form onSubmit={submit}>
        <DialogTitle>{t('profile.changeEmail')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}

            <Typography variant="body2" color="text.secondary">
              {t('profile.email.blurb')}
            </Typography>

            <TextField
              fullWidth
              autoFocus
              type="email"
              label={t('profile.email.new')}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              error={sameAsNow && email.length > 0}
              helperText={sameAsNow && email.length > 0 ? t('profile.email.sameAsNow') : ' '}
            />

            <TextField
              fullWidth
              type={reveal ? 'text' : 'password'}
              label={t('profile.password.current')}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setReveal((shown) => !shown)}
                      edge="end"
                      aria-label={t(reveal ? 'profile.password.hide' : 'profile.password.show')}
                    >
                      {reveal ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>{t('common.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={!submittable}>
            {t('profile.email.send')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ChangeEmailDialog;
