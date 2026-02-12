/**
 * Time Slot Configuration Section Component
 * 
 * Manages time slot configurations for a calendar.
 */

import React from 'react';
import { Box, Button, Typography, Card, CardContent } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import type { TimeSlotConfigurationFormData } from '../types/calendar.types';

interface TimeSlotConfigurationSectionProps {
  configurations: TimeSlotConfigurationFormData[];
  onChange: (configurations: TimeSlotConfigurationFormData[]) => void;
}

const TimeSlotConfigurationSection: React.FC<TimeSlotConfigurationSectionProps> = ({
  configurations,
  onChange,
}) => {
  const handleAddConfiguration = () => {
    const newConfig: TimeSlotConfigurationFormData = {
      daysOfWeek: [],
      startTime: '09:00',
      effectiveDateStart: new Date(),
      recurrenceWeeks: 1,
      placesAvailable: 1,
      durationOptions: [],
    };
    onChange([...configurations, newConfig]);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Time Slot Configurations</Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAddConfiguration}
        >
          Add Configuration
        </Button>
      </Box>
      
      {configurations.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              No time slot configurations yet. Add your first configuration to get started.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {configurations.map((config, index) => (
            <Card key={index}>
              <CardContent>
                <Typography variant="body2">Configuration {index + 1}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default TimeSlotConfigurationSection;
