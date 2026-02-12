/**
 * Blocked Periods Section Component
 * 
 * Manages blocked periods for a calendar.
 */

import React from 'react';
import { Box, Button, Typography, Card, CardContent } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import type { BlockedPeriodFormData } from '../types/calendar.types';

interface BlockedPeriodsSectionProps {
  blockedPeriods: BlockedPeriodFormData[];
  onChange: (periods: BlockedPeriodFormData[]) => void;
}

const BlockedPeriodsSection: React.FC<BlockedPeriodsSectionProps> = ({
  blockedPeriods,
  onChange,
}) => {
  const handleAddPeriod = () => {
    const newPeriod: BlockedPeriodFormData = {
      blockType: 'date_range',
      startDate: new Date(),
      endDate: new Date(),
    };
    onChange([...blockedPeriods, newPeriod]);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Blocked Periods</Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAddPeriod}
        >
          Add Blocked Period
        </Button>
      </Box>
      
      {blockedPeriods.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              No blocked periods configured.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {blockedPeriods.map((period, index) => (
            <Card key={index}>
              <CardContent>
                <Typography variant="body2">Blocked Period {index + 1}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default BlockedPeriodsSection;
