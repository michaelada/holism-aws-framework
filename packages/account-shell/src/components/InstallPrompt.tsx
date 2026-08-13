import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Snackbar, SnackbarContent, Stack, Typography } from '@mui/material';

/** The event Chromium fires when the app is installable. Not in lib.dom yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const VISITS_KEY = 'account-install:visits';
const DECIDED_KEY = 'account-install:decided';
const VISITS_BEFORE_ASKING = 3;

/**
 * H3 — offering to install the app.
 *
 * **Never on first load, and never twice.** A member who has just arrived does
 * not yet know whether they want this club's app on their home screen, and an
 * install prompt is the fastest way to make a first visit feel like an
 * advertisement. The design says the third visit or after a successful
 * checkout; this counts visits, and a checkout is a visit like any other.
 *
 * A decision either way is remembered. Chromium will not re-fire
 * `beforeinstallprompt` after an accepted install, but a member who declined
 * would otherwise be asked again on every visit — which is how a prompt becomes
 * something people learn to dismiss without reading.
 */
export const InstallPrompt: React.FC = () => {
  const { t } = useTranslation();
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let visits = 0;
    try {
      // Counted once per load, before any prompt can fire.
      visits = Number(window.localStorage.getItem(VISITS_KEY) ?? '0') + 1;
      window.localStorage.setItem(VISITS_KEY, String(visits));
    } catch {
      // Private mode. Without a count there is no third visit to wait for, so
      // the prompt simply never appears — which is the safe way to be wrong.
      return;
    }

    const decided = window.localStorage.getItem(DECIDED_KEY) === 'true';
    if (decided || visits < VISITS_BEFORE_ASKING) return;

    const capture = (fired: Event) => {
      // Held rather than shown: the browser's own prompt can only be opened
      // from a gesture, so this waits for the member to press the button.
      fired.preventDefault();
      setEvent(fired as BeforeInstallPromptEvent);
      setOpen(true);
    };

    window.addEventListener('beforeinstallprompt', capture);
    return () => window.removeEventListener('beforeinstallprompt', capture);
  }, []);

  const remember = () => {
    try {
      window.localStorage.setItem(DECIDED_KEY, 'true');
    } catch {
      /* Nothing to remember it with; the prompt reappearing is the lesser harm. */
    }
  };

  const install = async () => {
    setOpen(false);
    remember();
    if (!event) return;

    await event.prompt();
    // The outcome is the browser's to report and ours to stop asking about.
    await event.userChoice;
    setEvent(null);
  };

  const dismiss = () => {
    setOpen(false);
    remember();
  };

  if (!open) return null;

  return (
    <Snackbar
      open
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ mb: { xs: 8, md: 2 } }}
    >
      <SnackbarContent
        message={
          <Stack spacing={0.5}>
            <Typography variant="body2" fontWeight={600}>
              {t('install.title')}
            </Typography>
            <Typography variant="caption">{t('install.detail')}</Typography>
          </Stack>
        }
        action={
          <Stack direction="row" spacing={1}>
            <Button size="small" color="inherit" onClick={dismiss}>
              {t('install.notNow')}
            </Button>
            <Button size="small" variant="outlined" color="inherit" onClick={install}>
              {t('install.install')}
            </Button>
          </Stack>
        }
      />
    </Snackbar>
  );
};

export default InstallPrompt;
