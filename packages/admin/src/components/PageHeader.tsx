import { ReactNode } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Renders a labelled back control. Route it through an unsaved-changes guard on forms. */
  onBack?: () => void;
  backLabel?: string;
  /** Primary and secondary actions, right-aligned. */
  actions?: ReactNode;
}

/**
 * The page title block.
 *
 * Every page gets exactly one, and it renders a real `<h1>`. Before this, page
 * titles were `variant="h4"` — which emits an `<h4>` — so the application had
 * no `<h1>` anywhere except its unstyled 404, and heading order jumped
 * arbitrarily between sections. Screen-reader users had no document outline to
 * navigate by.
 */
export function PageHeader({ title, description, onBack, backLabel, actions }: PageHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 2,
        flexWrap: 'wrap',
        mb: 3,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
        {onBack && (
          <IconButton
            onClick={onBack}
            aria-label={backLabel ?? `Back from ${title}`}
            sx={{ mt: 0.25 }}
          >
            <ArrowBackIcon />
          </IconButton>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h1" component="h1">
            {title}
          </Typography>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: '70ch' }}>
              {description}
            </Typography>
          )}
        </Box>
      </Box>
      {actions && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>{actions}</Box>
      )}
    </Box>
  );
}
