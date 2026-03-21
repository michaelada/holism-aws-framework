/**
 * Time Slot Configuration Section Component
 *
 * Manages time slot configurations for a calendar.
 * Each configuration defines available booking slots with days of week,
 * start time, effective dates, recurrence, capacity, and duration options.
 */

import React from 'react';
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  TextField,
  FormControlLabel,
  Checkbox,
  IconButton,
  Grid,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import type { TimeSlotConfigurationFormData } from '../types/calendar.types';

interface TimeSlotConfigurationSectionProps {
  configurations: TimeSlotConfigurationFormData[];
  onChange: (configurations: TimeSlotConfigurationFormData[]) => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TimeSlotConfigurationSection: React.FC<TimeSlotConfigurationSectionProps> = ({
  configurations = [],
  onChange,
}) => {
  const { t } = useTranslation();

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

  const handleRemoveConfiguration = (index: number) => {
    const updated = configurations.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleConfigChange = (index: number, field: keyof TimeSlotConfigurationFormData, value: any) => {
    const updated = configurations.map((config, i) =>
      i === index ? { ...config, [field]: value } : config
    );
    onChange(updated);
  };

  const handleDayToggle = (configIndex: number, day: number) => {
    const config = configurations[configIndex];
    const newDays = config.daysOfWeek.includes(day)
      ? config.daysOfWeek.filter((d) => d !== day)
      : [...config.daysOfWeek, day];
    handleConfigChange(configIndex, 'daysOfWeek', newDays);
  };

  const handleAddDurationOption = (configIndex: number) => {
    const config = configurations[configIndex];
    const newOption = { duration: 60, price: 0, label: '' };
    handleConfigChange(configIndex, 'durationOptions', [...config.durationOptions, newOption]);
  };

  const handleRemoveDurationOption = (configIndex: number, optionIndex: number) => {
    const config = configurations[configIndex];
    const updated = config.durationOptions.filter((_, i) => i !== optionIndex);
    handleConfigChange(configIndex, 'durationOptions', updated);
  };

  const handleDurationOptionChange = (
    configIndex: number,
    optionIndex: number,
    field: string,
    value: any
  ) => {
    const config = configurations[configIndex];
    const updatedOptions = config.durationOptions.map((opt, i) =>
      i === optionIndex ? { ...opt, [field]: value } : opt
    );
    handleConfigChange(configIndex, 'durationOptions', updatedOptions);
  };

  const formatDateForInput = (date: Date | undefined): string => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">{t('calendar.sections.timeSlotConfiguration')}</Typography>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddConfiguration}>
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
          {configurations.map((config, configIndex) => (
            <Card key={configIndex}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1">Configuration {configIndex + 1}</Typography>
                  <IconButton onClick={() => handleRemoveConfiguration(configIndex)} size="small">
                    <DeleteIcon />
                  </IconButton>
                </Box>

                {/* Days of Week */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>{t('calendar.fields.daysOfWeek')}</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {DAY_NAMES.map((dayName, dayIndex) => (
                      <FormControlLabel
                        key={dayIndex}
                        control={
                          <Checkbox
                            checked={config.daysOfWeek.includes(dayIndex)}
                            onChange={() => handleDayToggle(configIndex, dayIndex)}
                            size="small"
                          />
                        }
                        label={dayName}
                      />
                    ))}
                  </Box>
                </Box>

                <Grid container spacing={2}>
                  {/* Start Time */}
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      label={t('calendar.fields.startTime')}
                      type="time"
                      value={config.startTime}
                      onChange={(e) => handleConfigChange(configIndex, 'startTime', e.target.value)}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>

                  {/* Effective Date Start */}
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      label={t('calendar.fields.effectiveDateStart')}
                      type="date"
                      value={formatDateForInput(config.effectiveDateStart)}
                      onChange={(e) => handleConfigChange(configIndex, 'effectiveDateStart', new Date(e.target.value))}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>

                  {/* Effective Date End */}
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      label={t('calendar.fields.effectiveDateEnd')}
                      type="date"
                      value={formatDateForInput(config.effectiveDateEnd)}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleConfigChange(configIndex, 'effectiveDateEnd', val ? new Date(val) : undefined);
                      }}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>

                  {/* Recurrence Weeks */}
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      label={t('calendar.fields.recurrenceWeeks')}
                      type="number"
                      value={config.recurrenceWeeks}
                      onChange={(e) => handleConfigChange(configIndex, 'recurrenceWeeks', parseInt(e.target.value) || 1)}
                      fullWidth
                      inputProps={{ min: 1 }}
                    />
                  </Grid>

                  {/* Places Available */}
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      label={t('calendar.fields.placesAvailable')}
                      type="number"
                      value={config.placesAvailable}
                      onChange={(e) => handleConfigChange(configIndex, 'placesAvailable', parseInt(e.target.value) || 1)}
                      fullWidth
                      inputProps={{ min: 1 }}
                    />
                  </Grid>
                </Grid>

                {/* Duration Options */}
                <Box sx={{ mt: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2">Duration Options</Typography>
                    <Button size="small" startIcon={<AddIcon />} onClick={() => handleAddDurationOption(configIndex)}>
                      Add Duration Option
                    </Button>
                  </Box>

                  {config.durationOptions.map((option, optionIndex) => (
                    <Box key={optionIndex} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                      <TextField
                        label={t('calendar.fields.durationOptionLabel')}
                        value={option.label}
                        onChange={(e) => handleDurationOptionChange(configIndex, optionIndex, 'label', e.target.value)}
                        size="small"
                      />
                      <TextField
                        label={t('calendar.fields.durationOptionDuration')}
                        type="number"
                        value={option.duration}
                        onChange={(e) => handleDurationOptionChange(configIndex, optionIndex, 'duration', parseInt(e.target.value) || 0)}
                        size="small"
                        inputProps={{ min: 1 }}
                      />
                      <TextField
                        label={t('calendar.fields.durationOptionPrice')}
                        type="number"
                        value={option.price}
                        onChange={(e) => handleDurationOptionChange(configIndex, optionIndex, 'price', parseFloat(e.target.value) || 0)}
                        size="small"
                        inputProps={{ min: 0, step: 0.01 }}
                      />
                      <IconButton onClick={() => handleRemoveDurationOption(configIndex, optionIndex)} size="small">
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default TimeSlotConfigurationSection;
