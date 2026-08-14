import { ReactNode, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** What the action does, in plain language. */
  message: ReactNode;
  /**
   * What else this action reaches. Rendered as a warning above the confirm
   * button. This is the whole point of the component: `PaymentFeeEditor`
   * already tells the operator how many organisations a change affects, and
   * every destructive action deserves the same courtesy.
   */
  consequences?: ReactNode;
  /**
   * When set, the operator must type this exact string to enable the confirm
   * button. Reserve it for actions that cannot be undone and reach beyond the
   * record on screen.
   */
  confirmPhrase?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `error` colours the confirm button red; `primary` is for reversible actions. */
  severity?: 'error' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The single confirmation surface for this app.
 *
 * Replaces `window.confirm`, which blocked the JS thread, could not be styled
 * or dismissed with Escape, and put its buttons in an OS-dependent order — so
 * an operator's muscle memory for "confirm" was wrong on half their machines.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  consequences,
  confirmPhrase,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  severity = 'error',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');

  // Reset the typed phrase whenever the dialog opens, so a previous attempt
  // never leaves the confirm button pre-enabled.
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  const phraseSatisfied = !confirmPhrase || typed.trim() === confirmPhrase;

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onCancel}
      maxWidth="sm"
      fullWidth
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id="confirm-dialog-description" component="div">
          {message}
        </DialogContentText>

        {consequences && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {consequences}
          </Alert>
        )}

        {confirmPhrase && (
          <TextField
            fullWidth
            size="small"
            sx={{ mt: 2 }}
            label={`Type "${confirmPhrase}" to confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            inputProps={{ 'aria-label': `Type ${confirmPhrase} to confirm this action` }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          color={severity}
          variant="contained"
          disabled={busy || !phraseSatisfied}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
