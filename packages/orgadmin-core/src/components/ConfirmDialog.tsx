import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

/**
 * One way to ask "are you sure?".
 *
 * The org-admin had three. Two screens called the browser's own `confirm()`,
 * which draws OS chrome with no styling, no product context and — decisively —
 * **no i18n**: an administrator working in German was asked "Are you sure you
 * want to delete this venue?" in English, by a dialog that did not look like
 * the product. Two more used MUI dialogs with the English typed straight into
 * the JSX. Every one of them breaks the six-locale constraint PRODUCT.md calls
 * durable.
 *
 * Deletion is also the moment an unpaid volunteer decides whether to trust this
 * software with the club's records, so it is a poor place for the interface to
 * fall back to something that looks like an error from the operating system.
 *
 * The destructive variant is the default because that is what every existing
 * caller is doing. `confirmLabel` should name the action — "Delete venue", not
 * "OK" — so the button says what will happen rather than agreeing with a
 * question the reader may have skimmed.
 */
export interface ConfirmDialogProps {
  open: boolean;
  /** What is about to happen, e.g. "Delete this venue?" */
  title: string;
  /** The consequence, in plain language. Optional when the title says it all. */
  body?: React.ReactNode;
  /** Names the action, not the agreement. */
  confirmLabel: string;
  /** Defaults to the shared "Cancel" string. */
  cancelLabel?: string;
  /** `false` for a reversible action, which takes the ordinary primary colour. */
  destructive?: boolean;
  /** Disables both buttons and marks the confirm as in flight. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onCancel}
      aria-labelledby="confirm-dialog-title"
      aria-describedby={body ? 'confirm-dialog-body' : undefined}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>

      {body && (
        <DialogContent>
          <DialogContentText id="confirm-dialog-body">{body}</DialogContentText>
        </DialogContent>
      )}

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {/*
          Cancel first in the DOM so it takes focus ahead of the destructive
          action: the safe choice should be the one a hurried keyboard user
          reaches by default.
        */}
        <Button onClick={onCancel} disabled={busy}>
          {cancelLabel ?? t('common.actions.cancel')}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={busy}
          variant="contained"
          color={destructive ? 'error' : 'primary'}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
