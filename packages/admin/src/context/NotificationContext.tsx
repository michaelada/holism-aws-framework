import { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';

interface NotificationContextValue {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<AlertColor>('info');

  const showNotification = useCallback((msg: string, sev: AlertColor) => {
    setMessage(msg);
    setSeverity(sev);
    setOpen(true);
  }, []);

  const showSuccess = useCallback((msg: string) => {
    showNotification(msg, 'success');
  }, [showNotification]);

  const showError = useCallback((msg: string) => {
    showNotification(msg, 'error');
  }, [showNotification]);

  const showInfo = useCallback((msg: string) => {
    showNotification(msg, 'info');
  }, [showNotification]);

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <NotificationContext.Provider value={{ showSuccess, showError, showInfo }}>
      {children}
      {/*
        Errors and successes used to share one channel with identical urgency
        and no live-region semantics, so a failed delete announced exactly like
        a successful one — or, more often, not at all.

        `role="alert"` interrupts a screen reader immediately for failures;
        successes use the polite `role="status"` so they queue behind whatever
        the operator is reading. Errors also stay on screen until dismissed,
        because six seconds is not long enough to read a failure and act on it.
      */}
      <Snackbar
        open={open}
        autoHideDuration={severity === 'error' ? null : 6000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={handleClose}
          severity={severity}
          role={severity === 'error' ? 'alert' : 'status'}
          sx={{ width: '100%' }}
        >
          {message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}
