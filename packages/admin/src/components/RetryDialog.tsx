import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@mui/material';
import { ErrorOutline as ErrorIcon, Refresh as RefreshIcon } from '@mui/icons-material';

interface RetryDialogProps {
  open: boolean;
  message: string;
  onRetry: () => void;
  onCancel: () => void;
}

export function RetryDialog({ open, message, onRetry, onCancel }: RetryDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ErrorIcon color="error" />
          Network Error
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography>{message}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Please check your internet connection and try again.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="inherit">
          Cancel
        </Button>
        <Button onClick={onRetry} variant="contained" startIcon={<RefreshIcon />}>
          Retry
        </Button>
      </DialogActions>
    </Dialog>
  );
}
