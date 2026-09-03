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

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  FormControl,
  FormHelperText,
  FormLabel,
  Grid,
  IconButton,
  InputAdornment,
  Snackbar,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Image as ImageIcon,
  HelpOutline as HelpIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useTranslation } from '@itsplainsailing/orgadmin-shell';
import { useApi } from '@itsplainsailing/orgadmin-core';
import {
  renderTicketHTML,
  generateQRCodeDataURL,
  TICKET_IMAGE_PLACEMENTS,
  TICKET_LAYOUTS,
  type TicketImagePlacement,
  type TicketLayout,
} from '@itsplainsailing/components';
import type { EventTicketingConfig } from '../types/ticketing.types';

/** Fields sent to PUT /events/:eventId/ticketing-config */
interface UpdateTicketingConfigDto {
  generateElectronicTickets: boolean;
  ticketHeaderText?: string;
  ticketInstructions?: string;
  ticketFooterText?: string;
  ticketValidityPeriod?: number;
  ticketBackgroundColor?: string;
  ticketImagePlacement?: TicketImagePlacement | null;
  ticketLayout?: TicketLayout;
}

interface FormState {
  generateElectronicTickets: boolean;
  ticketHeaderText: string;
  ticketInstructions: string;
  ticketFooterText: string;
  ticketValidityPeriod: string;
  ticketBackgroundColor: string;
  ticketImagePlacement: TicketImagePlacement;
  ticketLayout: TicketLayout;
}

const defaultFormState: FormState = {
  generateElectronicTickets: false,
  ticketHeaderText: '',
  ticketInstructions: '',
  ticketFooterText: '',
  ticketValidityPeriod: '',
  ticketBackgroundColor: '#ffffff',
  ticketImagePlacement: 'header',
  // What every ticket looked like before a club could choose.
  ticketLayout: 'stacked',
};

const EditTicketingSettingsPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { execute } = useApi();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [eventName, setEventName] = useState<string>('');
  /** The picture on the ticket: a signed URL once saved, a blob before then. */
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  /** A QR code for the preview. Not a real one — this ticket does not exist. */
  const [previewQr, setPreviewQr] = useState<string>('');
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
        ticketImagePlacement: config.ticketImagePlacement ?? 'header',
        ticketLayout: config.ticketLayout ?? 'stacked',
      });
      setImageUrl(config.ticketImageUrl ?? null);
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

  /**
   * A picture chosen but not yet uploaded, as a **data URL**.
   *
   * Read with `FileReader` rather than `URL.createObjectURL`, because the
   * preview is an `iframe` and the print frame is another: a blob URL belongs
   * to the document that made it, and the surest way to have a picture appear
   * in both is to carry the bytes rather than a reference to them.
   */
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!pendingImage) {
      setPendingUrl(null);
      return undefined;
    }

    let cancelled = false;
    const reader = new FileReader();
    reader.onload = () => {
      if (!cancelled) setPendingUrl(typeof reader.result === 'string' ? reader.result : null);
    };
    reader.readAsDataURL(pendingImage);

    return () => {
      cancelled = true;
      reader.abort();
    };
  }, [pendingImage]);

  const previewImage = pendingUrl ?? imageUrl;

  /*
   * A QR code for the preview only. It encodes the words "preview" rather than
   * a ticket reference, because no ticket exists yet — and a preview carrying a
   * scannable code somebody might photograph is worse than one that plainly
   * does not.
   */
  useEffect(() => {
    let cancelled = false;
    void generateQRCodeDataURL('preview', { width: 200, margin: 1 })
      .then((url) => {
        if (!cancelled) setPreviewQr(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * The ticket as it will print, from the form's state.
   *
   * Rendered by `renderTicketHTML` — the same function that prints the real
   * thing — so what a club approves here is what a member receives. A preview
   * drawn separately drifts, and what it gets wrong first is exactly what
   * somebody is checking.
   */
  const previewHtml = useMemo(
    () =>
      renderTicketHTML({
        ticketReference: 'TKT-0000-000000',
        qrCodeDataURL: previewQr,
        eventName: eventName || t('ticketing.settings.preview.sampleEvent'),
        eventDescription: t('ticketing.settings.preview.sampleEventDescription'),
        activityName: t('ticketing.settings.preview.sampleActivity'),
        activityDescription: t('ticketing.settings.preview.sampleActivityDescription'),
        startDate: new Date(),
        endDate: new Date(),
        customerName: t('ticketing.settings.preview.sampleHolder'),
        headerText: formState.ticketHeaderText,
        instructions: formState.ticketInstructions,
        footerText: formState.ticketFooterText,
        imageUrl: previewImage,
        imagePlacement: previewImage ? formState.ticketImagePlacement : null,
        layout: formState.ticketLayout,
        backgroundColour: formState.ticketBackgroundColor,
        locale: i18n.language,
      }),
    [previewQr, eventName, formState, previewImage, t, i18n.language]
  );

  /** Uploads the chosen picture against the saved configuration. */
  const uploadImage = async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    body.append('placement', formState.ticketImagePlacement);
    const saved = await execute({
      method: 'POST',
      url: `/api/orgadmin/events/${eventId}/ticketing-config/image`,
      data: body,
      throwOnError: true,
    });
    if (saved?.ticketImageUrl) setImageUrl(saved.ticketImageUrl);
    setPendingImage(null);
  };

  const removeImage = async () => {
    setPendingImage(null);
    if (!imageUrl) return;
    try {
      await execute({
        method: 'DELETE',
        url: `/api/orgadmin/events/${eventId}/ticketing-config/image`,
      });
      setImageUrl(null);
    } catch (err) {
      console.error('Failed to remove the ticket image:', err);
      setSnackbar({ open: true, message: t('ticketing.settings.saveError'), severity: 'error' });
    }
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
        ticketBackgroundColor: formState.ticketBackgroundColor || undefined,
        // Only meaningful with a picture; the server ignores it otherwise.
        ticketImagePlacement: previewImage ? formState.ticketImagePlacement : null,
        ticketLayout: formState.ticketLayout,
      };

      await execute({
        method: 'PUT',
        url: `/api/orgadmin/events/${eventId}/ticketing-config`,
        data: payload,
      });

      if (pendingImage) await uploadImage(pendingImage);

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3,
        // Wraps rather than overflowing: a non-wrapping header row pushed
        // page actions past the right edge of a phone, with nothing on
        // screen to show the page had scrolled.
        flexWrap: 'wrap', gap: 2 }}>
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
                /*
                  A picture replaces this rather than sitting under it, and a
                  club that has chosen both should be told which one wins
                  before they wonder why their green went away.
                */
                helperText={
                  previewImage && formState.ticketImagePlacement === 'background'
                    ? t('ticketing.settings.helpers.imageOverridesColour')
                    : t('ticketing.settings.helpers.ticketBackgroundColor')
                }
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

            {/* The picture, and where it goes. */}
            <Grid item xs={12}>
              <FormLabel>{t('ticketing.settings.fields.ticketImage')}</FormLabel>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ImageIcon />}
                  onClick={() => fileInput.current?.click()}
                >
                  {t('ticketing.settings.actions.chooseImage')}
                </Button>
                {previewImage && (
                  <Button size="small" color="error" onClick={removeImage}>
                    {t('ticketing.settings.actions.removeImage')}
                  </Button>
                )}
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  hidden
                  aria-label={t('ticketing.settings.fields.ticketImage')}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) setPendingImage(file);
                  }}
                />
              </Stack>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl disabled={!previewImage}>
                <FormLabel>{t('ticketing.settings.fields.ticketImagePlacement')}</FormLabel>
                <RadioGroup
                  value={formState.ticketImagePlacement}
                  onChange={(event) =>
                    handleFieldChange('ticketImagePlacement', event.target.value as TicketImagePlacement)
                  }
                >
                  {TICKET_IMAGE_PLACEMENTS.map((placement) => (
                    <FormControlLabel
                      key={placement}
                      value={placement}
                      control={<Radio />}
                      label={t(`ticketing.settings.placements.${placement}`)}
                    />
                  ))}
                </RadioGroup>
                {/* Told, rather than discovered in the preview. */}
                <FormHelperText>
                  {t('ticketing.settings.helpers.ticketImagePlacement')}
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl>
                <FormLabel>{t('ticketing.settings.fields.ticketLayout')}</FormLabel>
                <RadioGroup
                  value={formState.ticketLayout}
                  onChange={(event) =>
                    handleFieldChange('ticketLayout', event.target.value as TicketLayout)
                  }
                >
                  {TICKET_LAYOUTS.map((layout) => (
                    <FormControlLabel
                      key={layout}
                      value={layout}
                      control={<Radio />}
                      label={t(`ticketing.settings.layouts.${layout}`)}
                    />
                  ))}
                </RadioGroup>
                {/* The one thing a club cannot restyle, and why. */}
                <FormHelperText>{t('ticketing.settings.helpers.qrAlwaysWhite')}</FormHelperText>
              </FormControl>
            </Grid>

            {/*
              "Include Event Logo" was here and is gone. Nothing ever rendered a
              logo: no ticket template took one, and no organisation logo was
              passed to the one that could have — so it was a setting a club
              could turn on and see no difference from. The ticket image above,
              with its four placements, is what it was reaching for.
            */}
          </Grid>
        </CardContent>
      </Card>

      {/*
        The preview, under the settings rather than beside them: the form is a
        column of fields and a ticket is a wide thing, and squeezing both into
        halves makes each unreadable at the width a club actually works at.
      */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('ticketing.settings.preview.title')}
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            {t('ticketing.settings.preview.subtitle')}
          </Typography>
          {/*
            An iframe, so the ticket's own styles are the ticket's own: rendered
            inline it would inherit the org-admin's theme and stop being a
            preview of what prints.
          */}
          <Box
            component="iframe"
            title={t('ticketing.settings.preview.title')}
            srcDoc={previewHtml}
            sx={{ width: '100%', height: 640, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 1 }}
          />
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
