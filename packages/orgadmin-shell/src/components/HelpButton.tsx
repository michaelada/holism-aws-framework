/**
 * Help Button Component
 * 
 * A button in the navbar that toggles the help drawer.
 * Shows an active state when the drawer is open.
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 7.3
 */

import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useTranslation } from '../hooks/useTranslation';

interface HelpButtonProps {
  /** Callback when button is clicked */
  onClick: () => void;
  /** Whether the help drawer is currently open */
  active: boolean;
}

/**
 * HelpButton Component
 * 
 * Displays a help icon button with tooltip that toggles the help drawer.
 * Shows visual indication when the help drawer is active/open.
 */
export const HelpButton: React.FC<HelpButtonProps> = ({ onClick, active }) => {
  const { t } = useTranslation('help');

  return (
    <Tooltip title={t('button.tooltip', { defaultValue: 'Get help' })}>
      <IconButton
        onClick={onClick}
        color={active ? 'primary' : 'default'}
        aria-label={t('button.tooltip', { defaultValue: 'Get help' })}
        sx={{
          backgroundColor: active ? 'action.selected' : 'transparent',
          '&:hover': {
            backgroundColor: active ? 'action.hover' : 'action.hover',
          },
        }}
      >
        <HelpOutlineIcon />
      </IconButton>
    </Tooltip>
  );
};

export default HelpButton;
