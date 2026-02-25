/**
 * Help Drawer Component
 * 
 * A slide-out drawer from the right side displaying contextual help content.
 * Shows page-specific help with fallback to module overview and en-GB language.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.3, 6.2, 7.3, 8.2, 8.3, 8.5
 */

import React, { useMemo } from 'react';
import {
  Drawer,
  Box,
  IconButton,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from '../hooks/useTranslation';
import { ModuleId } from '../context/OnboardingContext';
import { LazyMarkdown } from './LazyMarkdown';

interface HelpDrawerProps {
  /** Whether the drawer is currently open */
  open: boolean;
  /** Callback when drawer is closed */
  onClose: () => void;
  /** Current page identifier */
  pageId: string;
  /** Current module identifier */
  moduleId: ModuleId;
}

/**
 * HelpDrawer Component
 * 
 * Displays contextual help content in a slide-out drawer from the right side.
 * Implements content resolution with fallback logic:
 * 1. Try page-specific help in current language
 * 2. Fall back to module overview in current language
 * 3. Fall back to page-specific help in en-GB
 * 4. Fall back to module overview in en-GB
 * 
 * Wrapped with React.memo to prevent unnecessary re-renders when props haven't changed.
 */
const HelpDrawerComponent: React.FC<HelpDrawerProps> = ({ 
  open, 
  onClose, 
  pageId, 
  moduleId 
}) => {
  const { t, i18n } = useTranslation('help');
  
  /**
   * Resolve help content with fallback logic
   * Tries multiple keys in order until content is found
   */
  const helpContent = useMemo(() => {
    const currentLang = i18n.language;
    
    // Try page-specific content in current language
    const pageKey = `${moduleId}.${pageId}`;
    const pageContent = t(pageKey, { defaultValue: '' });
    
    if (pageContent && pageContent !== pageKey) {
      return pageContent;
    }
    
    // Fall back to module overview in current language
    const overviewKey = `${moduleId}.overview`;
    const overviewContent = t(overviewKey, { defaultValue: '' });
    
    if (overviewContent && overviewContent !== overviewKey) {
      return overviewContent;
    }
    
    // Fall back to en-GB if current language is not en-GB
    if (currentLang !== 'en-GB') {
      // Try page-specific in en-GB
      const pageContentEnGB = t(pageKey, { lng: 'en-GB', defaultValue: '' });
      
      if (pageContentEnGB && pageContentEnGB !== pageKey) {
        return pageContentEnGB;
      }
      
      // Fall back to module overview in en-GB
      const overviewContentEnGB = t(overviewKey, { lng: 'en-GB', defaultValue: '' });
      
      if (overviewContentEnGB && overviewContentEnGB !== overviewKey) {
        return overviewContentEnGB;
      }
    }
    
    // If all else fails, show a helpful message
    return t('noContentAvailable', { 
      defaultValue: 'Help content is not yet available for this page.' 
    });
  }, [moduleId, pageId, t, i18n.language]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: 400,
          boxSizing: 'border-box',
        },
      }}
      aria-labelledby="help-drawer-title"
      aria-describedby="help-drawer-content"
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header with close button */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography id="help-drawer-title" variant="h6" component="h2">
            {t('drawer.title', { defaultValue: 'Help' })}
          </Typography>
          <IconButton
            onClick={onClose}
            aria-label={t('drawer.close', { defaultValue: 'Close help' })}
            edge="end"
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Scrollable content area */}
        <Box
          id="help-drawer-content"
          role="region"
          aria-label={t('drawer.contentLabel', { defaultValue: 'Help content' })}
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 2,
            '& h1': { fontSize: '1.5rem', mt: 0, mb: 2 },
            '& h2': { fontSize: '1.25rem', mt: 2, mb: 1 },
            '& h3': { fontSize: '1.1rem', mt: 1.5, mb: 0.75 },
            '& p': { mb: 1.5 },
            '& ul, & ol': { pl: 3, mb: 1.5 },
            '& li': { mb: 0.5 },
            '& strong': { fontWeight: 600 },
            '& a': { 
              color: 'primary.main',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
            },
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
            {helpContent}
          </LazyMarkdown>
        </Box>
      </Box>
    </Drawer>
  );
};

/**
 * Memoized HelpDrawer to prevent unnecessary re-renders
 */
export const HelpDrawer = React.memo(HelpDrawerComponent);

export default HelpDrawer;
