/**
 * Membership Type Selector Component
 * 
 * Dialog for selecting which membership type to use when creating a member.
 * Displays all available membership types with their names and descriptions.
 */

import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { MembershipType } from '../types/membership.types';

interface MembershipTypeSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (membershipTypeId: string) => void;
  membershipTypes: MembershipType[];
}

const MembershipTypeSelector: React.FC<MembershipTypeSelectorProps> = ({
  open,
  onClose,
  onSelect,
  membershipTypes,
}) => {
  const { t } = useTranslation();

  const handleSelect = (typeId: string) => {
    onSelect(typeId);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('memberships.typeSelector.title')}</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <List sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {membershipTypes.map((type) => (
            <ListItem 
              key={type.id} 
              disablePadding
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'hidden',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  borderColor: 'primary.main',
                  boxShadow: 1,
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <ListItemButton 
                onClick={() => handleSelect(type.id)}
                sx={{
                  py: 2,
                  px: 2.5,
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <ListItemText
                  primary={type.name}
                  secondary={type.description}
                  primaryTypographyProps={{
                    variant: 'subtitle1',
                    fontWeight: 500,
                    color: 'text.primary',
                  }}
                  secondaryTypographyProps={{
                    variant: 'body2',
                    color: 'text.secondary',
                    sx: { mt: 0.5 },
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {t('common.actions.cancel')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MembershipTypeSelector;
