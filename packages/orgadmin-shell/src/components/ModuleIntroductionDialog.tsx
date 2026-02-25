/**
 * Module Introduction Dialog Component
 * 
 * Modal dialog shown on first visit to each module that provides module-specific
 * overview and key features. Supports markdown content.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.5, 5.2, 6.1, 6.5, 7.3
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
} from '@mui/material';
import { useTranslation } from '../hooks/useTranslation';
import { ModuleId } from '../context/OnboardingContext';
import { LazyMarkdown } from './LazyMarkdown';

interface ModuleIntroductionDialogProps {
  /** Whether the dialog is currently open */
  open: boolean;
  /** The module identifier for which to show the introduction */
  moduleId: ModuleId;
  /** Callback when dialog is closed */
  onClose: () => void;
}

/**
 * ModuleIntroductionDialog Component
 * 
 * Displays an introduction message when a user visits a module for the first time.
 * Content is loaded from i18n translations based on the moduleId.
 * 
 * Wrapped with React.memo to prevent unnecessary re-renders when props haven't changed.
 */
const ModuleIntroductionDialogComponent: React.FC<ModuleIntroductionDialogProps> = ({ 
  open, 
  moduleId, 
  onClose 
}) => {
  const { t } = useTranslation('onboarding');

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md" 
      fullWidth
      aria-labelledby="module-intro-dialog-title"
      aria-describedby="module-intro-dialog-content"
    >
      <DialogTitle id="module-intro-dialog-title">
        {t(`modules.${moduleId}.title`)}
      </DialogTitle>
      
      <DialogContent>
        <Box 
          id="module-intro-dialog-content"
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
            {t(`modules.${moduleId}.content`)}
          </LazyMarkdown>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained" color="primary">
          {t('actions.gotIt')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Memoized ModuleIntroductionDialog to prevent unnecessary re-renders
 */
export const ModuleIntroductionDialog = React.memo(ModuleIntroductionDialogComponent);

export default ModuleIntroductionDialog;
