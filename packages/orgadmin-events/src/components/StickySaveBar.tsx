/**
 * StickySaveBar
 *
 * Fixed-position bar at the bottom of the viewport with Cancel,
 * Save as Draft, and Publish buttons. Buttons are disabled while
 * loading or when explicitly disabled via props.
 *
 * Requirements: 5.1, 5.2
 */

import React from 'react';
import { Box, Button, Paper } from '@mui/material';
import { Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';

export interface StickySaveBarProps {
  onCancel: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  loading: boolean;
  disabled?: boolean;
}

const StickySaveBar: React.FC<StickySaveBarProps> = ({
  onCancel,
  onSaveDraft,
  onPublish,
  loading,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const isDisabled = loading || disabled;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1300,
        px: 3,
        py: 1.5,
      }}
      data-testid="sticky-save-bar"
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Button
          variant="outlined"
          startIcon={<CancelIcon />}
          onClick={onCancel}
          disabled={isDisabled}
          data-testid="sticky-cancel-btn"
        >
          {loading ? t('events.editPage.saving') : t('events.editPage.cancel')}
        </Button>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={onSaveDraft}
            disabled={isDisabled}
            data-testid="sticky-save-draft-btn"
          >
            {loading ? t('events.editPage.saving') : t('events.editPage.saveDraft')}
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={onPublish}
            disabled={isDisabled}
            data-testid="sticky-publish-btn"
          >
            {loading ? t('events.editPage.saving') : t('events.editPage.publish')}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};

export default StickySaveBar;
