/**
 * Edit Ticketing Settings Page
 *
 * Dedicated page for editing ticketing-specific configuration for a single event.
 * Fetches the current config via GET /events/:eventId/ticketing-config and
 * persists changes via PUT /events/:eventId/ticketing-config using only
 * UpdateTicketingConfigDto fields.
 *
 * Requirements: 7.4, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  HelpOutline as HelpIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import { useApi } from '@aws-web-framework/orgadmin-core';
import type { EventTicketingConfig } from '../types/ticketing.types';

/** Fields sent to PUT /events/:eventId/ticketing-config */
interface UpdateTicketingConfigDto {
  generateElectronicTickets: boolean;
  ticketHeaderText?: string;
  ticketInstructions?: string;
  ticketFooterText?: string;
  ticketValidityPeriod?: number;
  includeEventLogo: boolean;
  ticketBackgroundColor?: string;
}

interface FormState {
  generateElectronicTickets: boolean;
  ticketHeaderText: string;
  ticketInstructions: string;
  ticketFooterText: string;
  ticketValidityPeriod: string;
  ticketBackgroundColor: string;
  includeEventLogo: boolean;
}

const defaultFormState: FormState = {
  generateElectronicTickets: false,
  ticketHeaderText: '',
  ticketInstructions: '',
  ticketFooterText: '',
  ticketValidityPeriod: '',
  ticketBackgroundColor: '#ffffff',
  includeEventLogo: false,
};

const EditTicketingSettingsPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { execute } = useApi();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [eventName, setEventName] = useState<string>('');
  const [formState, setFormState] = useState<FormState>(defaultFormState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const loadConfig = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);

      // Fetch ticketing config and event name in parallel
      const [config, salesData] = await Promise.all([
        execute({
          method: 'GET',
          url: `/api/orgadmin/events/${eventId}/ticketing-config`,
        }) as Promise<EventTicketingConfig>,
        execute({
          method: 'GET',
          url: `/api/orgadmin/events/${eventId}/ticket-sales`,
        }).catch(() => null) as Promise<{ eventName: string } | null>,
      ]);

      setEventName(salesData?.eventName || '');

      setFormState({
        generateElectronicTickets: config.generateElectronicTickets ?? false,
        ticketHeaderText: config.ticketHeaderText ?? '',
        ticketInstructions: config.ticketInstructions ?? '',
        ticketFooterText: config.ticketFooterText ?? '',
        ticketValidityPeriod: config.ticketValidityPeriod != null ? String(config.ticketValidityPeriod) : '',
        ticketBackgroundColor: config.ticketBackgroundColor ?? '#ffffff',
        includeEventLogo: config.includeEventLogo ?? false,
      });
    } catch (err: any) {
      console.error('Failed to load ticketing config:', err);
      if (err?.response?.status === 404 || err?.status === 404) {
        setError(t('ticketing.errors.invalidEvent'));
      } else {
        setError(t('ticketing.errors.loadFailed'));
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleFieldChange = (field: keyof FormState, value: any) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!eventId) return;
    try {
      setSaving(true);

      const payload: UpdateTicketingConfigDto = {
        generateElectronicTickets: formState.generateElectronicTickets,
        ticketHeaderText: formState.ticketHeaderText || undefined,
        ticketInstructions: formState.ticketInstructions || undefined,
        ticketFooterText: formState.ticketFooterText || undefined,
        ticketValidityPeriod: formState.ticketValidityPeriod ? parseInt(formState.ticketValidityPeriod, 10) : undefined,
        includeEventLogo: formState.includeEventLogo,
        ticketBackgroundColor: formState.ticketBackgroundColor || undefined,
      };

      await execute({
        method: 'PUT',
        url: `/api/orgadmin/events/${eventId}/ticketing-config`,
        data: payload,
      });

      setSnackbar({ open: true, message: t('ticketing.settings.saveSuccess'), severity: 'success' });

      // Navigate back to overview after successful save
      setTimeout(() => navigate('/tickets'), 500);
    } catch (err) {
      console.error('Failed to save ticketing settings:', err);
      setSnackbar({ open: true, message: t('ticketing.settings.saveError'), severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Error state with back navigation (invalid eventId / 404)
  if (error && !loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Box
          component={RouterLink}
          to="/tickets"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 3, textDecoration: 'none', color: 'primary.main' }}
        >
          <ArrowBackIcon fontSize="small" />
          <Typography variant="body2">{t('ticketing.settings.backToOverview')}</Typography>
        </Box>
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Box
          component={RouterLink}
          to="/tickets"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 3, textDecoration: 'none', color: 'primary.main' }}
        >
          <ArrowBackIcon fontSize="small" />
          <Typography variant="body2">{t('ticketing.settings.backToOverview')}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Back navigation */}
      <Box
        component={RouterLink}
        to="/tickets"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 2, textDecoration: 'none', color: 'primary.main' }}
      >
        <ArrowBackIcon fontSize="small" />
        <Typography variant="body2">{t('ticketing.settings.backToOverview')}</Typography>
      </Box>

      {/* Page heading with event name */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4">{eventName}</Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {t('ticketing.settings.title')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/tickets')}
          >
            {t('common.actions.cancel')}
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <CircularProgress size={20} /> : t('ticketing.settings.save')}
          </Button>
        </Box>
      </Box>

      {/* Ticketing Settings Card — extensible layout for future sections */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('ticketing.settings.title')}
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            {t('ticketing.settings.description')}
          </Typography>

          <Grid container spacing={3}>
            {/* Generate Electronic Tickets */}
            <Grid item xs={12}>
              <Tooltip title={t('ticketing.settings.tooltips.generateElectronicTickets')} arrow placement="right">
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formState.generateElectronicTickets}
                      onChange={(e) => handleFieldChange('generateElectronicTickets', e.target.checked)}
                    />
                  }
                  label={t('ticketing.settings.fields.generateElectronicTickets')}
                />
              </Tooltip>
            </Grid>

            {/* Ticket Header Text */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label={t('ticketing.settings.fields.ticketHeaderText')}
                value={formState.ticketHeaderText}
                onChange={(e) => handleFieldChange('ticketHeaderText', e.target.value)}
                helperText={t('ticketing.settings.helpers.ticketHeaderText')}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={t('ticketing.settings.tooltips.ticketHeaderText')} arrow placement="top">
                        <IconButton size="small" edge="end">
                          <HelpIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Ticket Instructions */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label={t('ticketing.settings.fields.ticketInstructions')}
                value={formState.ticketInstructions}
                onChange={(e) => handleFieldChange('ticketInstructions', e.target.value)}
                helperText={t('ticketing.settings.helpers.ticketInstructions')}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={t('ticketing.settings.tooltips.ticketInstructions')} arrow placement="top">
                        <IconButton size="small" edge="end">
                          <HelpIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Ticket Footer Text */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label={t('ticketing.settings.fields.ticketFooterText')}
                value={formState.ticketFooterText}
                onChange={(e) => handleFieldChange('ticketFooterText', e.target.value)}
                helperText={t('ticketing.settings.helpers.ticketFooterText')}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={t('ticketing.settings.tooltips.ticketFooterText')} arrow placement="top">
                        <IconButton size="small" edge="end">
                          <HelpIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Ticket Validity Period */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label={t('ticketing.settings.fields.ticketValidityPeriod')}
                value={formState.ticketValidityPeriod}
                onChange={(e) => handleFieldChange('ticketValidityPeriod', e.target.value)}
                helperText={t('ticketing.settings.helpers.ticketValidityPeriod')}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={t('ticketing.settings.tooltips.ticketValidityPeriod')} arrow placement="top">
                        <IconButton size="small" edge="end">
                          <HelpIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Ticket Background Color */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="color"
                label={t('ticketing.settings.fields.ticketBackgroundColor')}
                value={formState.ticketBackgroundColor}
                onChange={(e) => handleFieldChange('ticketBackgroundColor', e.target.value)}
                helperText={t('ticketing.settings.helpers.ticketBackgroundColor')}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={t('ticketing.settings.tooltips.ticketBackgroundColor')} arrow placement="top">
                        <IconButton size="small" edge="end">
                          <HelpIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Include Event Logo */}
            <Grid item xs={12}>
              <Tooltip title={t('ticketing.settings.tooltips.includeEventLogo')} arrow placement="right">
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formState.includeEventLogo}
                      onChange={(e) => handleFieldChange('includeEventLogo', e.target.checked)}
                    />
                  }
                  label={t('ticketing.settings.fields.includeEventLogo')}
                />
              </Tooltip>
              <Typography variant="caption" color="textSecondary" display="block" sx={{ ml: 4 }}>
                {t('ticketing.settings.helpers.includeEventLogo')}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Future settings cards can be added here */}

      {/* Snackbar for save success/error */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EditTicketingSettingsPage;
