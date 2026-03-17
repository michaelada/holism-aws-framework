/**
 * Registration Details Page
 *
 * Displays detailed information about a single registration including
 * registration number, entity name, owner name, registration type, status,
 * valid until, date last renewed, labels, processed flag, payment status,
 * and form submission data.
 *
 * Requirements: 4.1, 4.2, 4.3
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  IconButton,
  Link,
  Typography,
  Alert,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  CheckCircle as ProcessedIcon,
  RadioButtonUnchecked as UnprocessedIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useTranslation, formatDate } from '@aws-web-framework/orgadmin-shell';
import { useApi } from '@aws-web-framework/orgadmin-core';
import type { Registration } from '../types/registration.types';

const RegistrationDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { execute } = useApi();
  const { t, i18n } = useTranslation();

  const [registration, setRegistration] = useState<Registration | null>(null);
  const [registrationType, setRegistrationType] = useState<any | null>(null);
  const [formSubmission, setFormSubmission] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadRegistration(id);
    }
  }, [id]);

  const loadRegistration = async (registrationId: string) => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/registrations/${registrationId}`,
      });
      setRegistration(response);

      // Load registration type details
      if (response?.registrationTypeId) {
        const typeResponse = await execute({
          method: 'GET',
          url: `/api/orgadmin/registration-types/${response.registrationTypeId}`,
        });
        setRegistrationType(typeResponse);
      }

      // Load form submission details
      if (response?.formSubmissionId) {
        const submissionResponse = await execute({
          method: 'GET',
          url: `/api/orgadmin/form-submissions/${response.formSubmissionId}`,
        });
        setFormSubmission(submissionResponse);
      }
    } catch (err) {
      console.error('Failed to load registration:', err);
      setError(t('registrations.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    // Preserve previous filter state when navigating back
    const filterState = location.state as any;
    navigate('/registrations', { state: filterState });
  };

  const handleFileDownload = async (fileId: string, _fileName: string) => {
    try {
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/files/${fileId}`,
      });
      if (response?.url) {
        window.open(response.url, '_blank');
      }
    } catch (err) {
      console.error('Failed to download file:', err);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }} data-testid="loading-state">
        <Typography>{t('registrations.loadingRegistration')}</Typography>
      </Box>
    );
  }

  if (error || !registration) {
    return (
      <Box sx={{ p: 3 }} data-testid="error-state">
        <Alert severity="error">{error || t('registrations.registrationNotFound')}</Alert>
        <Button onClick={handleBack} sx={{ mt: 2 }}>
          {t('registrations.details.backToRegistrations')}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with back button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={handleBack} data-testid="back-button">
            <BackIcon />
          </IconButton>
          <Typography variant="h4">
            {registration.entityName}
          </Typography>
          <Chip
            label={t(`registrations.status.${registration.status}`)}
            color={registration.status === 'active' ? 'success' : registration.status === 'pending' ? 'warning' : 'default'}
          />
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Basic Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('registrations.sections.registrationInfo')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('registrations.fields.registrationNumber')}
                  </Typography>
                  <Typography variant="body1" data-testid="registration-number">
                    {registration.registrationNumber}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('registrations.fields.entityName')}
                  </Typography>
                  <Typography variant="body1" data-testid="entity-name">
                    {registration.entityName}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('registrations.fields.ownerName')}
                  </Typography>
                  <Typography variant="body1" data-testid="owner-name">
                    {registration.ownerName}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('registrations.fields.registrationType')}
                  </Typography>
                  <Typography variant="body1" data-testid="registration-type">
                    {registrationType?.name || registration.registrationTypeId}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Status and Dates */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('registrations.sections.statusAndDates')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('registrations.fields.status')}
                  </Typography>
                  <Chip
                    data-testid="status"
                    label={t(`registrations.status.${registration.status}`)}
                    color={registration.status === 'active' ? 'success' : registration.status === 'pending' ? 'warning' : 'default'}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('registrations.fields.validUntil')}
                  </Typography>
                  <Typography variant="body1" data-testid="valid-until">
                    {formatDate(registration.validUntil, 'dd MMM yyyy', i18n.language)}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('registrations.fields.dateLastRenewed')}
                  </Typography>
                  <Typography variant="body1" data-testid="date-last-renewed">
                    {formatDate(registration.dateLastRenewed, 'dd MMM yyyy', i18n.language)}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('registrations.fields.processed')}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} data-testid="processed-flag">
                    {registration.processed ? (
                      <ProcessedIcon color="success" data-testid="processed-icon" />
                    ) : (
                      <UnprocessedIcon data-testid="unprocessed-icon" />
                    )}
                    <Typography variant="body1">
                      {registration.processed
                        ? t('registrations.processedStatus.processed')
                        : t('registrations.processedStatus.unprocessed')}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Labels */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('registrations.sections.labels')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }} data-testid="labels">
                {registration.labels.length > 0 ? (
                  registration.labels.map((label) => (
                    <Chip key={label} label={label} />
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('registrations.labels.noLabelsAssigned')}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Payment Information */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('registrations.sections.paymentInfo')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('registrations.fields.paymentStatus')}
                  </Typography>
                  <Chip
                    data-testid="payment-status"
                    label={t(`registrations.paymentStatus.${registration.paymentStatus}`)}
                    color={registration.paymentStatus === 'paid' ? 'success' : 'default'}
                  />
                </Grid>
                {registration.paymentMethod && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      {t('registrations.fields.paymentMethod')}
                    </Typography>
                    <Typography variant="body1" data-testid="payment-method">
                      {registration.paymentMethod}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Form Submission Data */}
        {formSubmission && formSubmission.submissionData && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('registrations.sections.formSubmissionData')}
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2} data-testid="form-submission-data">
                  {Object.entries(formSubmission.submissionData).map(([key, value]: [string, any]) => {
                    if (value === null || value === undefined || value === '') return null;
                    if (Array.isArray(value) && value.length === 0) return null;

                    const fieldLabel = key
                      .split('_')
                      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(' ');

                    let displayValue: React.ReactNode;
                    if (Array.isArray(value)) {
                      const isFileArray = value.some(item =>
                        item && typeof item === 'object' && (item.fileId || item.name || item.url || item.fileName)
                      );

                      if (isFileArray) {
                        const validFiles = value.filter(item =>
                          item && typeof item === 'object' && Object.keys(item).length > 0 && (item.fileId || item.name || item.url || item.fileName)
                        );
                        if (validFiles.length === 0) return null;

                        displayValue = (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {validFiles.map((file, index) => {
                              const fileName = file.fileName || file.name || 'Uploaded file';
                              const fileId = file.fileId;
                              if (fileId) {
                                return (
                                  <Link
                                    key={index}
                                    component="button"
                                    variant="body1"
                                    onClick={() => handleFileDownload(fileId, fileName)}
                                    sx={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
                                  >
                                    <DownloadIcon fontSize="small" />
                                    {fileName}
                                  </Link>
                                );
                              }
                              return (
                                <Typography key={index} variant="body1">{fileName}</Typography>
                              );
                            })}
                          </Box>
                        );
                      } else {
                        const stringValue = value
                          .filter(item => typeof item === 'string' || typeof item === 'number')
                          .join(', ');
                        if (!stringValue) return null;
                        displayValue = stringValue;
                      }
                    } else if (typeof value === 'object') {
                      if (Object.keys(value).length === 0) return null;
                      return null;
                    } else if (typeof value === 'boolean') {
                      displayValue = value ? 'Yes' : 'No';
                    } else if (key.includes('date') && typeof value === 'string') {
                      try {
                        displayValue = formatDate(new Date(value), 'dd MMM yyyy', i18n.language);
                      } catch {
                        displayValue = String(value);
                      }
                    } else {
                      displayValue = String(value);
                    }

                    return (
                      <Grid item xs={12} md={6} key={key}>
                        <Typography variant="subtitle2" color="text.secondary">
                          {fieldLabel}
                        </Typography>
                        {typeof displayValue === 'string' ? (
                          <Typography variant="body1">{displayValue}</Typography>
                        ) : (
                          displayValue
                        )}
                      </Grid>
                    );
                  })}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default RegistrationDetailsPage;
