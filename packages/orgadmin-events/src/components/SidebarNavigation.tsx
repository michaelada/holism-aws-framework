/**
 * SidebarNavigation
 *
 * Sticky sidebar listing section titles as anchor links. Highlights the
 * currently visible section. Hidden below MUI `md` breakpoint.
 *
 * Requirements: 4.1, 4.2, 4.4, 4.5
 */

import React from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';

export interface SidebarNavigationProps {
  sections: Array<{ id: string; title: string }>;
  activeSectionId: string | null;
  onSectionClick: (sectionId: string) => void;
}

const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
  sections,
  activeSectionId,
  onSectionClick,
}) => {
  return (
    <Box
      component="nav"
      aria-label="Section navigation"
      sx={{
        display: { xs: 'none', md: 'block' },
        position: 'sticky',
        top: 16,
      }}
    >
      <Typography variant="subtitle2" sx={{ px: 2, py: 1, fontWeight: 600 }}>
        Sections
      </Typography>
      <List disablePadding>
        {sections.map((section) => {
          const isActive = section.id === activeSectionId;
          return (
            <ListItemButton
              key={section.id}
              selected={isActive}
              onClick={() => onSectionClick(section.id)}
              sx={{
                borderLeft: 3,
                borderColor: isActive ? 'primary.main' : 'transparent',
                py: 0.75,
              }}
              data-testid={`sidebar-link-${section.id}`}
            >
              <ListItemText
                primary={section.title}
                primaryTypographyProps={{
                  variant: 'body2',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'primary.main' : 'text.secondary',
                }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
};

export default SidebarNavigation;
