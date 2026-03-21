/**
 * EditEventPage
 *
 * Single scrollable page for editing an existing event. Renders all form
 * sections (Basic Info, Event Dates, Ticketing, Activities) as vertically
 * stacked collapsible cards with a sticky sidebar for navigation and a
 * sticky save bar at the bottom.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 6.1, 6.2
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Grid, Typography, Alert } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { useApi } from '@aws-web-framework/orgadmin-core';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import { useEventForm } from '../hooks/useEventForm';
import { useEventValidation } from '../hooks/useEventValidation';
import { useSectionObserver } from '../hooks/useSectionObserver';
import CollapsibleSection from '../components/CollapsibleSection';
import SidebarNavigation from '../components/SidebarNavigation';
import StickySaveBar from '../components/StickySaveBar';
import EventBasicInfoSection from '../components/sections/EventBasicInfoSection';
import EventDatesSection from '../components/sections/EventDatesSection';
import EventTicketingSection from '../components/sections/EventTicketingSection';
import EventActivitiesSection from '../components/sections/EventActivitiesSection';

interface SectionConfig {
  id: string;
  titleKey: string;
  component: React.ComponentType<any>;
}

const EDIT_PAGE_SECTIONS: SectionConfig[] = [
  { id: 'basic-info', titleKey: 'events.basicInfo.title', component: EventBasicInfoSection },
  { id: 'event-dates', titleKey: 'events.dates.title', component: EventDatesSection },
  { id: 'ticketing', titleKey: 'events.ticketing.title', component: EventTicketingSection },
  { id: 'activities', titleKey: 'events.activities.title', component: EventActivitiesSection },
];

const EditEventPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();
  const { t } = useTranslation();

  // Form state and reference data
  const {
    formData,
    fieldErrors,
    setFieldErrors,
    loading,
    error,
    eventTypes,
    venues,
    paymentMethods,
    discounts,
    handleChange,
    handleAddActivity,
    handleUpdateActivity,
    handleRemoveActivity,
    handleClearFieldError,
    fetchDiscounts,
    loadEvent,
  } = useEventForm();

  const { validateAll } = useEventValidation();
  const { activeSectionId, sectionRefs, registerSection } = useSectionObserver();

  // All sections expanded by default
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() =>
    EDIT_PAGE_SECTIONS.reduce(
      (acc, section) => ({ ...acc, [section.id]: true }),
      {} as Record<string, boolean>,
    ),
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isLoading = loading || saving;
  const displayError = saveError || error;

  // Load event data on mount
  useEffect(() => {
    if (id) {
      loadEvent(id);
    }
  }, [id, loadEvent]);

  // Toggle a section's expanded state
  const handleToggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  }, []);

  // Sidebar click: expand collapsed section, then scroll to it
  const handleSidebarClick = useCallback(
    (sectionId: string) => {
      // Expand the section if collapsed
      setExpandedSections((prev) => {
        if (!prev[sectionId]) {
          return { ...prev, [sectionId]: true };
        }
        return prev;
      });

      // Scroll to the section after a short delay to allow expansion animation
      requestAnimationFrame(() => {
        const element = sectionRefs.current.get(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      });
    },
    [sectionRefs],
  );

  // Find the first section that has validation errors
  const findFirstErrorSection = (errors: Record<string, string>): string | null => {
    // Basic info fields
    if (errors.name || errors.description) return 'basic-info';
    // Activities
    if (errors.activities) return 'activities';
    return null;
  };

  // Save handler
  const handleSave = useCallback(
    async (status: 'draft' | 'published') => {
      if (!id) return;

      try {
        setSaving(true);
        setSaveError(null);
        setFieldErrors({});

        const errors = validateAll(formData);

        if (Object.keys(errors).length > 0) {
          setFieldErrors(errors);
          setSaveError(t('events.fixValidationErrors'));

          // Expand and scroll to the first section with errors
          const errorSection = findFirstErrorSection(errors);
          if (errorSection) {
            setExpandedSections((prev) => ({ ...prev, [errorSection]: true }));
            requestAnimationFrame(() => {
              const element = sectionRefs.current.get(errorSection);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
              }
            });
          }
          return;
        }

        const dataToSave = { ...formData, status };

        await execute({
          method: 'PUT',
          url: `/api/orgadmin/events/${id}`,
          data: dataToSave,
        });

        navigate('/events');
      } catch (err) {
        console.error('Failed to save event:', err);
        setSaveError(t('events.failedToSave'));
      } finally {
        setSaving(false);
      }
    },
    [id, formData, validateAll, setFieldErrors, execute, navigate, t, sectionRefs],
  );

  const handleCancel = useCallback(() => {
    navigate('/events');
  }, [navigate]);

  // Build sidebar sections with translated titles
  const sidebarSections = EDIT_PAGE_SECTIONS.map((section) => ({
    id: section.id,
    title: t(section.titleKey),
  }));

  // Props for each section component, keyed by section id
  const sectionProps: Record<string, Record<string, any>> = {
    'basic-info': {
      formData,
      fieldErrors,
      onChange: handleChange,
      onClearFieldError: handleClearFieldError,
      eventTypes,
      venues,
      discounts,
      fetchDiscounts,
    },
    'event-dates': {
      formData,
      onChange: handleChange,
    },
    ticketing: {
      formData,
      onChange: handleChange,
    },
    activities: {
      formData,
      fieldErrors,
      onAddActivity: handleAddActivity,
      onUpdateActivity: handleUpdateActivity,
      onRemoveActivity: handleRemoveActivity,
      onClearFieldError: handleClearFieldError,
      paymentMethods,
    },
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      <Box sx={{ p: 3, pb: 10 }}>
        <Typography variant="h4" gutterBottom>
          {t('events.editEvent')}
        </Typography>

        {displayError && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setSaveError(null)}>
            {displayError}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Main content area – 9 columns */}
          <Grid item xs={12} md={9}>
            {EDIT_PAGE_SECTIONS.map((section) => {
              const SectionComponent = section.component;
              return (
                <Box
                  key={section.id}
                  sx={{ mb: 3 }}
                  ref={(el: HTMLElement | null) => registerSection(section.id, el)}
                >
                  <CollapsibleSection
                    id={section.id}
                    title={t(section.titleKey)}
                    expanded={expandedSections[section.id] ?? true}
                    onToggle={() => handleToggleSection(section.id)}
                  >
                    <SectionComponent {...sectionProps[section.id]} />
                  </CollapsibleSection>
                </Box>
              );
            })}
          </Grid>

          {/* Sidebar – 3 columns */}
          <Grid item xs={12} md={3}>
            <SidebarNavigation
              sections={sidebarSections}
              activeSectionId={activeSectionId}
              onSectionClick={handleSidebarClick}
            />
          </Grid>
        </Grid>
      </Box>

      <StickySaveBar
        onCancel={handleCancel}
        onSaveDraft={() => handleSave('draft')}
        onPublish={() => handleSave('published')}
        loading={isLoading}
      />
    </LocalizationProvider>
  );
};

export default EditEventPage;
