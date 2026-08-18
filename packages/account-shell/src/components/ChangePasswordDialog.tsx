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
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useAccountApi, AccountApiError } from '../hooks/useAccountApi';

/**
 * P4 — changing a password without leaving the app.
 *
 * **The rules are Keycloak's, and so is the complaint.** A realm can require
 * length, digits, mixed case or no reuse of the last N, and those rules can be
 * tightened without this component being touched. Checking them here as well
 * would produce a second opinion that eventually disagrees with the one that
 * actually decides — so the only thing checked locally is that the two new
 * fields match, which is about the member's typing rather than about policy.
 *
 * **A wrong current password and a refused new one read differently.** Telling
 * somebody "that didn't work" when their new password was merely too short
 * sends them off to reset a password they knew perfectly well.
 */

interface Props {
  open: boolean;
  orgCode: string;
  onClose: () => void;
  onChanged: () => void;
}

export const ChangePasswordDialog: React.FC<Props> = ({ open, orgCode, onClose, onChanged }) => {
  const { t } = useTranslation();
  const { execute } = useAccountApi<void>();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setReveal(false);
    setError(null);
    setSaving(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const mismatch = confirm.length > 0 && next !== confirm;
  const submittable = current.length > 0 && next.length > 0 && next === confirm && !saving;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!submittable) return;

    setSaving(true);
    setError(null);

    try {
      await execute({
        method: 'POST',
        url: `/api/account/${orgCode}/profile/password`,
        data: { currentPassword: current, newPassword: next },
      });
      reset();
      onChanged();
    } catch (err) {
      /*
       * The server's message verbatim. It is either "that is not your current
       * password" or Keycloak's own policy complaint, and both say more than
       * anything this component could substitute for them.
       */
      setError(
        err instanceof AccountApiError && err.message
          ? err.message
          : t('profile.password.failed')
      );
      setSaving(false);
    }
  };

  const revealAdornment = (
    <InputAdornment position="end">
      <IconButton
        onClick={() => setReveal((shown) => !shown)}
        edge="end"
        aria-label={t(reveal ? 'profile.password.hide' : 'profile.password.show')}
      >
        {reveal ? <VisibilityOffIcon /> : <VisibilityIcon />}
      </IconButton>
    </InputAdornment>
  );

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
      <form onSubmit={submit}>
        <DialogTitle>{t('profile.changePassword')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              fullWidth
              autoFocus
              type={reveal ? 'text' : 'password'}
              label={t('profile.password.current')}
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              autoComplete="current-password"
              InputProps={{ endAdornment: revealAdornment }}
            />

            <TextField
              fullWidth
              type={reveal ? 'text' : 'password'}
              label={t('profile.password.new')}
              value={next}
              onChange={(event) => setNext(event.target.value)}
              autoComplete="new-password"
              InputProps={{ endAdornment: revealAdornment }}
            />

            <TextField
              fullWidth
              type={reveal ? 'text' : 'password'}
              label={t('profile.password.confirm')}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              error={mismatch}
              helperText={mismatch ? t('profile.password.mismatch') : ' '}
            />

            {/*
              Said before they commit, not after. One identity spans every club
              a member belongs to, and somebody changing their password at the
              pony club is changing how they sign in to the tennis club too.
            */}
            <Typography variant="body2" color="text.secondary">
              {t('profile.password.appliesEverywhere')}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>{t('common.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={!submittable}>
            {t('profile.changePassword')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ChangePasswordDialog;
