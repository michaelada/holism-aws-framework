import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { People } from '@mui/icons-material';

const MembershipsPlaceholder: React.FC = () => {
  return (
    <Box sx={{ p: 4 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <People sx={{ fontSize: 80, color: '#ff9966', mb: 2 }} />
        <Typography variant="h4" gutterBottom>
          Membership Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          The Memberships module is currently in development.
        </Typography>
      </Paper>
    </Box>
  );
};

export default MembershipsPlaceholder;
