/**
 * Event Activity Form Component
 * 
 * Form for creating or editing event activities with enhanced attributes
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Collapse,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useApi, useOrganisation } from '@aws-web-framework/orgadmin-core';
import { useTranslation, useLocale } from '@aws-web-framework/orgadmin-shell';
import { formatCurrency } from '@aws-web-framework/orgadmin-shell';
import type { EventActivityFormData } from '../types/event.types';

interface EventActivityFormProps {
  activity: EventActivityFormData;
  index: number;
  onChange: (activity: EventActivityFormData) => void;
  onRemove: () => void;
}

interface ApplicationForm {
  id: string;
  name: string;
}

const EventActivityForm: React.FC<EventActivityFormProps> = ({
  activity,
  index,
  onChange,
  onRemove,
}) => {
  const { execute } = useApi();
  const { organisation } = useOrganisation();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [applicationForms, setApplicationForms] = useState<ApplicationForm[]>([]);
  const [loading, setLoading] = useState(false);

  const loadApplicationForms = useCallback(async () => {
    if (!organisation?.id) return;
    
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisations/${organisation.id}/application-forms`,
      });
      setApplicationForms(response || []);
    } catch (error) {
      console.error('Failed to load application forms:', error);
      setApplicationForms([]);
    } finally {
      setLoading(false);
    }
  }, [organisation?.id, execute]);

  useEffect(() => {
    loadApplicationForms();
  }, [loadApplicationForms]);

  const handleChange = (field: keyof EventActivityFormData, value: any) => {
    onChange({ ...activity, [field]: value });
  };

  return (
    <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" fontWeight="medium">
          {t('events.activities.activity.activityNumber', { number: index + 1 })}: {activity.name || t('events.activities.activity.untitled')}
        </Typography>
        <Box>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
          <IconButton size="small" color="error" onClick={onRemove}>
            <DeleteIcon />
          </IconButton>
        </Box>
      </Box>

      <Collapse in={expanded}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              required
              label={t('events.activities.activity.name')}
              value={activity.name}
              onChange={(e) => handleChange('name', e.target.value)}
              helperText={t('events.activities.activity.nameHelper')}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label={t('events.activities.activity.description')}
              value={activity.description}
              onChange={(e) => handleChange('description', e.target.value)}
              helperText={t('events.activities.activity.descriptionHelper')}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={activity.showPublicly}
                  onChange={(e) => handleChange('showPublicly', e.target.checked)}
                />
              }
              label={t('events.activities.activity.showPublicly')}
            />
          </Grid>

          <Grid item xs={12}>
            <FormControl fullWidth required>
              <InputLabel>{t('events.activities.activity.applicationForm')}</InputLabel>
              <Select
                value={activity.applicationFormId || ''}
                label={t('events.activities.activity.applicationForm')}
                onChange={(e) => handleChange('applicationFormId', e.target.value)}
                disabled={loading}
              >
                <MenuItem value="">
                  <em>{loading ? t('events.activities.activity.loadingForms') : t('events.activities.activity.selectForm')}</em>
                </MenuItem>
                {applicationForms.map((form) => (
                  <MenuItem key={form.id} value={form.id}>
                    {form.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={activity.limitApplicants}
                  onChange={(e) => handleChange('limitApplicants', e.target.checked)}
                />
              }
              label={t('events.activities.activity.limitApplicants')}
            />
          </Grid>

          {activity.limitApplicants && (
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label={t('events.activities.activity.applicantsLimit')}
                value={activity.applicantsLimit || ''}
                onChange={(e) => handleChange('applicantsLimit', parseInt(e.target.value) || undefined)}
                helperText={t('events.activities.activity.applicantsLimitHelper')}
              />
            </Grid>
          )}

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={activity.allowSpecifyQuantity}
                  onChange={(e) => handleChange('allowSpecifyQuantity', e.target.checked)}
                />
              }
              label={t('events.activities.activity.allowSpecifyQuantity')}
            />
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={activity.useTermsAndConditions}
                  onChange={(e) => handleChange('useTermsAndConditions', e.target.checked)}
                />
              }
              label={t('events.activities.activity.useTermsAndConditions')}
            />
          </Grid>

          {activity.useTermsAndConditions && (
            <Grid item xs={12}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {t('events.activities.activity.termsAndConditions')}
              </Typography>
              <ReactQuill
                value={activity.termsAndConditions || ''}
                onChange={(value) => handleChange('termsAndConditions', value)}
                theme="snow"
                modules={{
                  toolbar: [
                    [{ header: [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline'],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    ['clean'],
                  ],
                }}
              />
            </Grid>
          )}

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              label={t('events.activities.activity.fee')}
              value={activity.fee}
              onChange={(e) => handleChange('fee', parseFloat(e.target.value) || 0)}
              helperText={t('events.activities.activity.feeHelper')}
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Grid>

          {activity.fee > 0 && (
            <>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>{t('events.activities.activity.allowedPaymentMethod')}</InputLabel>
                  <Select
                    value={activity.allowedPaymentMethod}
                    label={t('events.activities.activity.allowedPaymentMethod')}
                    onChange={(e) => handleChange('allowedPaymentMethod', e.target.value)}
                  >
                    <MenuItem value="card">{t('events.activities.activity.paymentMethods.card')}</MenuItem>
                    <MenuItem value="cheque">{t('events.activities.activity.paymentMethods.cheque')}</MenuItem>
                    <MenuItem value="both">{t('events.activities.activity.paymentMethods.both')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {(activity.allowedPaymentMethod === 'card' || activity.allowedPaymentMethod === 'both') && (
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={activity.handlingFeeIncluded}
                        onChange={(e) => handleChange('handlingFeeIncluded', e.target.checked)}
                      />
                    }
                    label={t('events.activities.activity.handlingFeeIncluded')}
                  />
                </Grid>
              )}

              {(activity.allowedPaymentMethod === 'cheque' || activity.allowedPaymentMethod === 'both') && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label={t('events.activities.activity.chequePaymentInstructions')}
                    value={activity.chequePaymentInstructions || ''}
                    onChange={(e) => handleChange('chequePaymentInstructions', e.target.value)}
                    helperText={t('events.activities.activity.chequePaymentInstructionsHelper')}
                  />
                </Grid>
              )}
            </>
          )}
        </Grid>
      </Collapse>
    </Box>
  );
};

export default EventActivityForm;
