/**
 * Calendar Toolbar Component
 * 
 * Custom toolbar replacing the default react-big-calendar toolbar.
 * Provides view mode toggle, date navigation, date range label,
 * and calendar selector.
 */

import React from 'react';
import {
  Box,
  IconButton,
  Select,
  MenuItem,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  CalendarToday,
} from '@mui/icons-material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import type { Calendar } from '../types/calendar.types';

interface CalendarToolbarProps {
  viewMode: 'day' | 'week' | 'month';
  onViewModeChange: (mode: 'day' | 'week' | 'month') => void;
  currentDate: Date;
  onNavigate: (action: 'PREV' | 'NEXT' | 'TODAY') => void;
  calendars: Calendar[];
  selectedCalendarId: string | null;
  onCalendarSelect: (calendarId: string) => void;
  label: string;
}

const CalendarToolbar: React.FC<CalendarToolbarProps> = ({
  viewMode,
  onViewModeChange,
  currentDate: _currentDate,
  onNavigate,
  calendars,
  selectedCalendarId,
  onCalendarSelect,
  label,
}) => {
  const { t } = useTranslation();

  const handleViewModeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newMode: 'day' | 'week' | 'month' | null,
  ) => {
    if (newMode !== null) {
      onViewModeChange(newMode);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 1,
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      {/* Left: Calendar selector */}
      <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 200 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <Select
            value={selectedCalendarId ?? ''}
            onChange={(e) => onCalendarSelect(e.target.value)}
            displayEmpty
          >
            {calendars.map((cal) => (
              <MenuItem key={cal.id} value={cal.id}>
                {cal.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Center: Navigation and date label */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton
          onClick={() => onNavigate('PREV')}
          aria-label={t('calendar.bookingView.previous')}
          size="small"
        >
          <ChevronLeft />
        </IconButton>

        <IconButton
          onClick={() => onNavigate('TODAY')}
          aria-label={t('calendar.bookingView.today')}
          size="small"
        >
          <CalendarToday />
        </IconButton>

        <IconButton
          onClick={() => onNavigate('NEXT')}
          aria-label={t('calendar.bookingView.next')}
          size="small"
        >
          <ChevronRight />
        </IconButton>

        <Typography variant="h6" sx={{ mx: 1, whiteSpace: 'nowrap' }}>
          {label}
        </Typography>
      </Box>

      {/* Right: View mode toggle */}
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewModeChange}
          size="small"
        >
          <ToggleButton value="day">
            {t('calendar.bookingView.viewDay')}
          </ToggleButton>
          <ToggleButton value="week">
            {t('calendar.bookingView.viewWeek')}
          </ToggleButton>
          <ToggleButton value="month">
            {t('calendar.bookingView.viewMonth')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </Box>
  );
};

export default CalendarToolbar;
