/**
 * Welcome Dialog Component
 * 
 * Modal dialog shown on first login that provides application overview.
 * Supports markdown content and "Don't show again" preference.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 5.1, 6.1, 6.5, 7.3
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControlLabel,
  Checkbox,
  Box,
} from '@mui/material';
import { useTranslation } from '../hooks/useTranslation';
import { LazyMarkdown } from './LazyMarkdown';

interface WelcomeDialogProps {
  /** Whether the dialog is currently open */
  open: boolean;
  /** Callback when dialog is closed, receives checkbox state */
  onClose: (dontShowAgain: boolean) => void;
}

/**
 * WelcomeDialog Component
 * 
 * Displays a welcome message to first-time users with application overview.
 * Users can choose to permanently dismiss the dialog via checkbox.
 * 
 * Wrapped with React.memo to prevent unnecessary re-renders when props haven't changed.
 */
const WelcomeDialogComponent: React.FC<WelcomeDialogProps> = ({ open, onClose }) => {
  const { t } = useTranslation('onboarding');
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = () => {
    onClose(dontShowAgain);
    // Reset checkbox state after close
    setDontShowAgain(false);
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md" 
      fullWidth
      aria-labelledby="welcome-dialog-title"
      aria-describedby="welcome-dialog-content"
    >
      <DialogTitle id="welcome-dialog-title">
        {t('welcome.title')}
      </DialogTitle>
      
      <DialogContent>
        <Box 
          id="welcome-dialog-content"
          sx={{ 
            '& h1': { fontSize: '1.5rem', mt: 2, mb: 1 },
            '& h2': { fontSize: '1.25rem', mt: 2, mb: 1 },
            '& h3': { fontSize: '1.1rem', mt: 1.5, mb: 0.75 },
            '& p': { mb: 1 },
            '& ul, & ol': { pl: 3, mb: 1 },
            '& li': { mb: 0.5 },
            '& strong': { fontWeight: 600 },
          }}
        >
          <LazyMarkdown
            components={{
              // Ensure semantic HTML elements are used
              h1: ({ node, ...props }) => <h1 {...props} />,
              h2: ({ node, ...props }) => <h2 {...props} />,
              h3: ({ node, ...props }) => <h3 {...props} />,
              p: ({ node, ...props }) => <p {...props} />,
              ul: ({ node, ...props }) => <ul {...props} />,
              ol: ({ node, ...props }) => <ol {...props} />,
              li: ({ node, ...props }) => <li {...props} />,
              strong: ({ node, ...props }) => <strong {...props} />,
              em: ({ node, ...props }) => <em {...props} />,
              a: ({ node, ...props }) => <a {...props} rel="noopener noreferrer" />,
            }}
          >
            {t('welcome.content')}
          </LazyMarkdown>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 2, flexDirection: 'column', alignItems: 'stretch', gap: 1 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              inputProps={{
                'aria-label': t('welcome.dontShowAgain'),
              }}
            />
          }
          label={t('welcome.dontShowAgain')}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={handleClose} variant="contained" color="primary">
            {t('translation:common.actions.close')}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Memoized WelcomeDialog to prevent unnecessary re-renders
 */
export const WelcomeDialog = React.memo(WelcomeDialogComponent);

export default WelcomeDialog;
