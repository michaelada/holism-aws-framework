import React from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Typography,
} from '@mui/material';
import type { OrganizationAdminRole } from '../types/organization.types';

interface RoleSelectorProps {
  roles: OrganizationAdminRole[];
  selectedRoleIds: string[];
  onChange: (roleIds: string[]) => void;
  multiple?: boolean;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({
  roles,
  selectedRoleIds,
  onChange,
  multiple = true,
}) => {
  const handleChange = (event: any) => {
    const value = event.target.value;
    if (multiple) {
      onChange(typeof value === 'string' ? value.split(',') : value);
    } else {
      onChange([value]);
    }
  };

  return (
    <Box>
      <FormControl fullWidth>
        <InputLabel>Roles</InputLabel>
        <Select
          multiple={multiple}
          value={multiple ? selectedRoleIds : selectedRoleIds[0] || ''}
          onChange={handleChange}
          label="Roles"
          renderValue={(selected) => {
            if (multiple) {
              return (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map((roleId) => {
                    const role = roles.find((r) => r.id === roleId);
                    return (
                      <Chip
                        key={roleId}
                        label={role?.displayName || roleId}
                        size="small"
                      />
                    );
                  })}
                </Box>
              );
            } else {
              const role = roles.find((r) => r.id === selected);
              return role?.displayName || '';
            }
          }}
        >
          {roles.length === 0 ? (
            <MenuItem value="" disabled>
              No roles available
            </MenuItem>
          ) : (
            roles.map((role) => (
              <MenuItem key={role.id} value={role.id}>
                <Box>
                  <Typography variant="body2">{role.displayName}</Typography>
                  {role.description && (
                    <Typography variant="caption" color="textSecondary">
                      {role.description}
                    </Typography>
                  )}
                </Box>
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>
      <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
        {multiple
          ? 'Select one or more roles to assign to this user'
          : 'Select a role to assign to this user'}
      </Typography>
    </Box>
  );
};
