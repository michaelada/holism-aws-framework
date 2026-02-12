/**
 * Bookings Calendar Page (Calendar View)
 * 
 * Visual calendar display of bookings using react-big-calendar.
 */

import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import type { Calendar } from '../types/calendar.types';

const BookingsCalendarPage: React.FC = () => {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<string>('all');

  useEffect(() => {
    loadCalendars();
  }, []);

  const loadCalendars = async () => {
    try {
      // API call
      setCalendars([]);
    } catch (error) {
      console.error('Failed to load calendars:', error);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Calendar View</Typography>
      
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Calendar</InputLabel>
            <Select
              value={selectedCalendar}
              label="Calendar"
              onChange={(e) => setSelectedCalendar(e.target.value)}
            >
              <MenuItem value="all">All Calendars</MenuItem>
              {calendars.map((cal) => (
                <MenuItem key={cal.id} value={cal.id}>{cal.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            React Big Calendar will be integrated here
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default BookingsCalendarPage;
