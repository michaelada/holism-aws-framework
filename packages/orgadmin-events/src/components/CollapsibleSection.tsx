/**
 * CollapsibleSection
 *
 * Generic wrapper that renders a section inside an MUI Card with an
 * expandable/collapsible header. Provides an anchor target via the `id`
 * attribute on the root Card element.
 *
 * Requirements: 3.1, 3.2, 6.1, 6.2, 6.3, 6.4
 */

import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Collapse,
  IconButton,
} from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';

export interface CollapsibleSectionProps {
  id: string;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  id,
  title,
  expanded,
  onToggle,
  children,
}) => {
  return (
    <Card id={id}>
      <Box
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          cursor: 'pointer',
          userSelect: 'none',
        }}
        aria-expanded={expanded}
        aria-controls={`${id}-content`}
        data-testid={`section-header-${id}`}
      >
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        <IconButton
          size="small"
          aria-label={expanded ? 'Collapse section' : 'Expand section'}
          tabIndex={-1}
        >
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        <CardContent id={`${id}-content`}>{children}</CardContent>
      </Collapse>
    </Card>
  );
};

export default CollapsibleSection;
