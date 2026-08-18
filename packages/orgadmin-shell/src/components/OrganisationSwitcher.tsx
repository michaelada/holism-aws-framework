import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  CircularProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CheckIcon from '@mui/icons-material/Check';

/**
 * O1 — which club an administrator is working in, and how to change it.
 *
 * **An administrator of one sees a label, not a menu.** That falls out of the
 * list having one entry rather than out of a setting, so there is nothing to
 * configure and nothing to get wrong. The name still shows, because it is the
 * widest piece of context on the screen.
 *
 * **A switch is not a relabelling.** Capabilities belong to the organisation,
 * so the navigation itself differs between two clubs — a module one has and the
 * other does not simply is not there afterwards. The shell re-resolves
 * everything from `/auth/me` and returns to the dashboard, because half the
 * time the current page is a module the other club does not have and the
 * alternative is a capability-denied screen immediately after choosing.
 *
 * See docs/ORGADMIN_MULTI_ORGANISATION_WIREFRAMES.md.
 */

export interface OrganisationOption {
  id: string;
  displayName: string;
}

interface Props {
  organisations: OrganisationOption[];
  currentId: string | null | undefined;
  onSwitch: (organisationId: string) => void | Promise<void>;
}

export const OrganisationSwitcher: React.FC<Props> = ({
  organisations,
  currentId,
  onSwitch,
}) => {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [switching, setSwitching] = useState(false);

  const current = organisations.find((org) => org.id === currentId);
  const label = current?.displayName ?? t('navigation.loading');

  // One organisation, or none resolved yet: nothing to choose between.
  if (organisations.length <= 1) {
    return (
      <Typography
        variant="body2"
        sx={{ display: { xs: 'none', md: 'block' }, mr: 2 }}
        color="text.secondary"
      >
        {label}
      </Typography>
    );
  }

  const choose = async (organisationId: string) => {
    setAnchor(null);
    if (organisationId === currentId) return;

    setSwitching(true);
    try {
      await onSwitch(organisationId);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <Box sx={{ display: { xs: 'none', md: 'block' }, mr: 2 }}>
      <Button
        size="small"
        color="inherit"
        onClick={(event) => setAnchor(event.currentTarget)}
        disabled={switching}
        endIcon={switching ? <CircularProgress size={14} /> : <ArrowDropDownIcon />}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        // Named rather than "Organisation", so a screen reader announces which
        // club is being administered rather than that a menu exists.
        aria-label={t('organisationSwitcher.current', { name: label })}
        sx={{ textTransform: 'none', color: 'text.secondary' }}
      >
        {label}
      </Button>

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <Typography
          variant="overline"
          sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary' }}
        >
          {t('organisationSwitcher.heading')}
        </Typography>

        {organisations.map((org) => (
          <MenuItem
            key={org.id}
            selected={org.id === currentId}
            onClick={() => choose(org.id)}
          >
            <ListItemIcon>{org.id === currentId ? <CheckIcon fontSize="small" /> : null}</ListItemIcon>
            <ListItemText primary={org.displayName} />
          </MenuItem>
        ))}

        <Typography
          variant="caption"
          sx={{ px: 2, pt: 1, pb: 0.5, display: 'block', color: 'text.secondary' }}
        >
          {t('organisationSwitcher.count', { count: organisations.length })}
        </Typography>
      </Menu>
    </Box>
  );
};

export default OrganisationSwitcher;
