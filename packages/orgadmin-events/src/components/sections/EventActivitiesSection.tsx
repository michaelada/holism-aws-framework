/**
 * EventActivitiesSection
 *
 * Extracted from CreateEventPage.renderActivities().
 * Renders the activities management section for an event:
 * header with "Add Activity" button, validation error alert,
 * empty-state info alert, and a list of EventActivityForm components.
 */

import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Divider,
  Alert,
} from '@mui/material';
import EventActivityForm from '../EventActivityForm';
import type { EventFormData, EventActivityFormData } from '../../types/event.types';

export interface EventActivitiesSectionProps {
  formData: EventFormData;
  fieldErrors: Record<string, string>;
  onAddActivity: () => void;
  onUpdateActivity: (index: number, activity: EventActivityFormData) => void;
  onRemoveActivity: (index: number) => void;
  onClearFieldError: (field: string) => void;
  paymentMethods: Array<{ id: string; name: string }>;
}

const EventActivitiesSection: React.FC<EventActivitiesSectionProps> = ({
  formData,
  fieldErrors,
  onAddActivity,
  onUpdateActivity,
  onRemoveActivity,
  onClearFieldError,
  paymentMethods,
}) => {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6">
              Event Activities
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Add activities that people can register for
            </Typography>
          </Box>
          <Button
            variant="outlined"
            onClick={onAddActivity}
          >
            Add Activity
          </Button>
        </Box>

        {fieldErrors.activities && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {fieldErrors.activities}
          </Alert>
        )}

        {formData.activities.length === 0 ? (
          <Alert severity="info">
            Add at least one activity to complete your event setup
          </Alert>
        ) : (
          formData.activities.map((activity, index) => (
            <Box key={index} sx={{ mb: 2 }}>
              {index > 0 && <Divider sx={{ my: 3 }} />}
              <EventActivityForm
                activity={activity}
                index={index}
                onChange={(updatedActivity) => {
                  onUpdateActivity(index, updatedActivity);
                  if (fieldErrors.activities) {
                    onClearFieldError('activities');
                  }
                }}
                onRemove={() => onRemoveActivity(index)}
                paymentMethods={paymentMethods}
              />
            </Box>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default EventActivitiesSection;
