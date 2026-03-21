/**
 * Blocked Periods Section Component
 *
 * Manages blocked periods for a calendar.
 * Each blocked period can be either a date range or a recurring time segment.
 * Date range blocks specify start/end dates.
 * Time segment blocks specify days of week and start/end times.
 */

import React from 'react';
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  IconButton,
  Grid,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import type { BlockedPeriodFormData } from '../types/calendar.types';

interface BlockedPeriodsSectionProps {
  blockedPeriods: BlockedPeriodFormData[];
  onChange: (periods: BlockedPeriodFormData[]) => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const BlockedPeriodsSection: React.FC<BlockedPeriodsSectionProps> = ({
  blockedPeriods = [],
  onChange,
}) => {
  const { t } = useTranslation();

  const handleAddPeriod = () => {
    const newPeriod: BlockedPeriodFormData = {
      blockType: 'date_range',
      startDate: new Date(),
      endDate: new Date(),
    };
    onChange([...blockedPeriods, newPeriod]);
  };

  const handleRemovePeriod = (index: number) => {
    const updated = blockedPeriods.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handlePeriodChange = (index: number, field: keyof BlockedPeriodFormData, value: any) => {
    const updated = blockedPeriods.map((period, i) =>
      i === index ? { ...period, [field]: value } : period
    );
    onChange(updated);
  };

  const handleBlockTypeChange = (index: number, newType: 'date_range' | 'time_segment') => {
    const updated = blockedPeriods.map((period, i) => {
      if (i !== index) return period;
      if (newType === 'date_range') {
        return {
          blockType: 'date_range' as const,
          startDate: new Date(),
          endDate: new Date(),
          reason: period.reason,
        };
      }
      return {
        blockType: 'time_segment' as const,
        daysOfWeek: [],
        startTime: '09:00',
        endTime: '17:00',
        reason: period.reason,
      };
    });
    onChange(updated);
  };

  const handleDayToggle = (periodIndex: number, day: number) => {
    const period = blockedPeriods[periodIndex];
    const currentDays = period.daysOfWeek || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day];
    handlePeriodChange(periodIndex, 'daysOfWeek', newDays);
  };

  const formatDateForInput = (date: Date | undefined): string => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">{t('calendar.sections.blockedPeriods')}</Typography>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddPeriod}>
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
          {blockedPeriods.map((period, periodIndex) => (
            <Card key={periodIndex}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1">Blocked Period {periodIndex + 1}</Typography>
                  <IconButton onClick={() => handleRemovePeriod(periodIndex)} size="small">
                    <DeleteIcon />
                  </IconButton>
                </Box>

                {/* Block Type Selector */}
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>{t('calendar.fields.blockType')}</InputLabel>
                  <Select
                    value={period.blockType}
                    label={t('calendar.fields.blockType')}
                    onChange={(e) => handleBlockTypeChange(periodIndex, e.target.value as 'date_range' | 'time_segment')}
                  >
                    <MenuItem value="date_range">Date Range</MenuItem>
                    <MenuItem value="time_segment">Time Segment</MenuItem>
                  </Select>
                </FormControl>

                {period.blockType === 'date_range' ? (
                  /* Date Range Fields */
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label={t('calendar.fields.blockedStartDate')}
                        type="date"
                        value={formatDateForInput(period.startDate)}
                        onChange={(e) => handlePeriodChange(periodIndex, 'startDate', new Date(e.target.value))}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label={t('calendar.fields.blockedEndDate')}
                        type="date"
                        value={formatDateForInput(period.endDate)}
                        onChange={(e) => handlePeriodChange(periodIndex, 'endDate', new Date(e.target.value))}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label={t('calendar.fields.blockedReason')}
                        value={period.reason || ''}
                        onChange={(e) => handlePeriodChange(periodIndex, 'reason', e.target.value)}
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                ) : (
                  /* Time Segment Fields */
                  <>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>{t('calendar.fields.blockedDaysOfWeek')}</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {DAY_NAMES.map((dayName, dayIndex) => (
                          <FormControlLabel
                            key={dayIndex}
                            control={
                              <Checkbox
                                checked={(period.daysOfWeek || []).includes(dayIndex)}
                                onChange={() => handleDayToggle(periodIndex, dayIndex)}
                                size="small"
                              />
                            }
                            label={dayName}
                          />
                        ))}
                      </Box>
                    </Box>

                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          label={t('calendar.fields.blockedStartTime')}
                          type="time"
                          value={period.startTime || ''}
                          onChange={(e) => handlePeriodChange(periodIndex, 'startTime', e.target.value)}
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          label={t('calendar.fields.blockedEndTime')}
                          type="time"
                          value={period.endTime || ''}
                          onChange={(e) => handlePeriodChange(periodIndex, 'endTime', e.target.value)}
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          label={t('calendar.fields.blockedReason')}
                          value={period.reason || ''}
                          onChange={(e) => handlePeriodChange(periodIndex, 'reason', e.target.value)}
                          fullWidth
                        />
                      </Grid>
                    </Grid>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default BlockedPeriodsSection;