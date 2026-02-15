import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { Festival } from '@mui/icons-material';

const EventsPlaceholder: React.FC = () => {
  return (
    <Box sx={{ p: 4 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Festival sx={{ fontSize: 80, color: '#d84315', mb: 2 }} />
        <Typography variant="h4" gutterBottom>
          Event Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          The Events module is currently in development.
        </Typography>
      </Paper>
    </Box>
  );
};

export default EventsPlaceholder;
