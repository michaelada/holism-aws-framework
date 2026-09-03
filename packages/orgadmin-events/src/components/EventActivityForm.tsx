/**
 * Event Activity Form Component
 * 
 * Form for creating or editing event activities with enhanced attributes
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Box,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
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
import { useTranslation, formatCurrency, useLocale } from '@aws-web-framework/orgadmin-shell';
import { DiscountSelector, type Discount } from '@aws-web-framework/components';
import type { EventActivityFormData } from '../types/event.types';

interface EventActivityFormProps {
  activity: EventActivityFormData;
  index: number;
  onChange: (activity: EventActivityFormData) => void;
  onRemove: () => void;
  paymentMethods: Array<{ id: string; name: string }>;
  /**
   * When true, mandatory fields that have not been completed are highlighted.
   * The parent sets this once the user has tried to save or advance, so a
   * freshly added activity does not open covered in errors.
   */
  showErrors?: boolean;
}

interface ApplicationForm {
  id: string;
  name: string;
}

const isCardPaymentMethod = (name: string): boolean => {
  const lower = name.toLowerCase();
  return lower.includes('card') || lower.includes('stripe') || lower.includes('helix');
};

const EventActivityForm: React.FC<EventActivityFormProps> = ({
  activity,
  index,
  onChange,
  onRemove,
  paymentMethods,
  showErrors = false,
}) => {
  const { execute } = useApi();
  const { organisation } = useOrganisation();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [expanded, setExpanded] = useState(true);
  const [applicationForms, setApplicationForms] = useState<ApplicationForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loadingDiscounts, setLoadingDiscounts] = useState(false);

  const loadApplicationForms = useCallback(async () => {
    if (!organisation?.id) return;
    
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisations/${organisation.id}/application-forms`,
      });
      /*
       * Only an array is usable here. An error body (`{ error: ... }`) is
       * truthy, so `response || []` would store an object and the render below
       * died on `.map` — a blank activity form where a failed load should have
       * shown an empty picker.
       */
      setApplicationForms(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Failed to load application forms:', error);
      setApplicationForms([]);
    } finally {
      setLoading(false);
    }
  }, [organisation?.id, execute]);

  const loadDiscounts = useCallback(async () => {
    if (!organisation?.id) return;
    
    try {
      setLoadingDiscounts(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisations/${organisation.id}/discounts/events`,
      });
      // Extract discounts array from response object
      setDiscounts(response?.discounts || []);
    } catch (error) {
      console.error('Failed to load discounts:', error);
      // Silently fail - discounts are optional
      setDiscounts([]);
    } finally {
      setLoadingDiscounts(false);
    }
  }, [organisation?.id, execute]);

  /**
   * Whether to offer "members only" at all.
   *
   * Two conditions, and both matter. The capability alone is not enough: a club
   * that has switched memberships on but has nobody on file would be offered a
   * setting whose only possible effect is to lock every one of its members out
   * of its own event — a foot-gun disguised as a feature.
   *
   * Starts `false` and turns on once the answer arrives, so the field never
   * flickers in and out while the check is in flight.
   */
  const [hasMembers, setHasMembers] = useState(false);

  // From the organisation itself — the same list the module registry gates on.
  const usesMemberships = Boolean(organisation?.enabledCapabilities?.includes('memberships'));

  const loadHasMembers = useCallback(async () => {
    if (!usesMemberships) {
      setHasMembers(false);
      return;
    }
    try {
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/members/exists',
      });
      setHasMembers(Boolean(response?.hasMembers));
    } catch {
      /*
       * Hide the field rather than guess. Showing it on a failed check risks
       * a club setting a restriction we could not confirm it can satisfy;
       * hiding it costs an administrator one reload.
       */
      setHasMembers(false);
    }
  }, [execute, usesMemberships]);

  /**
   * Whether entries may be opened across the whole organisation type.
   *
   * A separate capability, granted per club by a super admin, because it lets
   * one club's event admit another club's members — a decision about the
   * federation rather than about this event.
   */
  const usesOrgLevelMembers = Boolean(
    organisation?.enabledCapabilities?.includes('organisation-level-members')
  );

  /*
   * The group appears if *either* restriction is available. A club with the
   * federation capability but no members of its own still has something worth
   * choosing — it can open an event to the other branches — so gating the whole
   * group on having members would hide the option it does have.
   */
  const showOwnMembersOption = usesMemberships && hasMembers;
  const showEligibility = showOwnMembersOption || usesOrgLevelMembers;

  useEffect(() => {
    loadApplicationForms();
    loadDiscounts();
    loadHasMembers();
  }, [loadApplicationForms, loadDiscounts, loadHasMembers]);

  // An application form must always be selected; only flag it once the parent
  // has told us the user has attempted to save.
  const applicationFormError = showErrors && !activity.applicationFormId;
  const applicationFormLabelId = `activity-${index}-application-form-label`;

  const handleChange = (field: keyof EventActivityFormData, value: any) => {
    onChange({ ...activity, [field]: value });
  };

  const handlePaymentMethodsChange = (value: any) => {
    const newMethods = value as string[];
    const newHasCard = newMethods.some((id) => {
      const method = paymentMethods.find((pm) => pm.id === id);
      return method ? isCardPaymentMethod(method.name) : false;
    });
    if (!newHasCard && activity.handlingFeeIncluded) {
      onChange({ ...activity, supportedPaymentMethods: newMethods, handlingFeeIncluded: false });
      return;
    }
    onChange({ ...activity, supportedPaymentMethods: newMethods });
  };

  const hasCardPayment = (activity.supportedPaymentMethods || []).some((id) => {
    const method = paymentMethods.find((pm) => pm.id === id);
    return method ? isCardPaymentMethod(method.name) : false;
  });

  const hasOfflinePayment = (activity.supportedPaymentMethods || []).some((id) => {
    const method = paymentMethods.find((pm) => pm.id === id);
    return method ? !isCardPaymentMethod(method.name) : false;
  });

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
              required
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
            <FormControl fullWidth required error={applicationFormError}>
              <InputLabel id={applicationFormLabelId}>
                {t('events.activities.activity.applicationForm')}
              </InputLabel>
              <Select
                labelId={applicationFormLabelId}
                value={activity.applicationFormId || ''}
                label={t('events.activities.activity.applicationForm')}
                onChange={(e) => handleChange('applicationFormId', e.target.value)}
                disabled={loading}
              >
                {/* Placeholder only – an application form is mandatory, so it
                    cannot be chosen to clear a previous selection. */}
                <MenuItem value="" disabled>
                  <em>{loading ? t('events.activities.activity.loadingForms') : t('events.activities.activity.selectForm')}</em>
                </MenuItem>
                {applicationForms.map((form) => (
                  <MenuItem key={form.id} value={form.id}>
                    {form.name}
                  </MenuItem>
                ))}
              </Select>
              {applicationFormError && (
                <FormHelperText>
                  {t('events.activities.validation.applicationFormRequired')}
                </FormHelperText>
              )}
            </FormControl>
          </Grid>

          {/*
            Who before how many.

            Placed above the applicant limit deliberately: "who can enter" is
            settled before "how many of them", and a club that restricts entry
            to members is often sizing the field against that smaller group.

            Absent altogether unless the club both uses memberships and has some
            — see `showEligibility`.
          */}
          {showEligibility && (
            <Grid item xs={12}>
              <FormControl component="fieldset">
                <FormLabel component="legend" sx={{ mb: 1 }}>
                  {t('events.activities.activity.whoCanEnter')}
                </FormLabel>
                <RadioGroup
                  value={activity.entryEligibility ?? 'all'}
                  onChange={(e) =>
                    handleChange('entryEligibility', e.target.value as 'all' | 'members')
                  }
                >
                  <FormControlLabel
                    value="all"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="body2">
                          {t('events.activities.activity.entriesOpenToAll')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('events.activities.activity.entriesOpenToAllHint')}
                        </Typography>
                      </Box>
                    }
                  />
                  {showOwnMembersOption && (
                    <FormControlLabel
                      value="members"
                      control={<Radio />}
                      label={
                        <Box>
                          <Typography variant="body2">
                            {t('events.activities.activity.entriesMembersOnly')}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t('events.activities.activity.entriesMembersOnlyHint')}
                          </Typography>
                        </Box>
                      }
                    />
                  )}
                  {usesOrgLevelMembers && (
                    <FormControlLabel
                      value="org-type-members"
                      control={<Radio />}
                      label={
                        <Box>
                          <Typography variant="body2">
                            {t('events.activities.activity.entriesOrgTypeMembers')}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t('events.activities.activity.entriesOrgTypeMembersHint')}
                          </Typography>
                        </Box>
                      }
                    />
                  )}
                </RadioGroup>

                {/*
                  Said before it is saved, not discovered afterwards by a member
                  who cannot enter.
                */}
                {activity.entryEligibility === 'members' && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    {t('events.activities.activity.entriesMembersOnlyNote')}
                  </Alert>
                )}
                {/*
                  Stated before saving, because this is the one option whose
                  effect reaches outside the club: the event becomes visible to
                  every other branch of the same type.
                */}
                {activity.entryEligibility === 'org-type-members' && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    {t('events.activities.activity.entriesOrgTypeMembersNote')}
                  </Alert>
                )}
              </FormControl>
            </Grid>
          )}

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

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              inputProps={{ min: 1, step: 1 }}
              label={t('events.activities.activity.ticketsAdmit')}
              value={activity.ticketsAdmit ?? 1}
              onChange={(e) =>
                handleChange('ticketsAdmit', Math.max(1, parseInt(e.target.value, 10) || 1))
              }
              helperText={t('events.activities.activity.ticketsAdmitHelper')}
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
              label={t('events.activities.activity.feeCurrency', { currency: organisation?.currency || 'EUR' })}
              value={activity.fee}
              onChange={(e) => handleChange('fee', parseFloat(e.target.value) || 0)}
              helperText={activity.fee > 0 ? formatCurrency(activity.fee, organisation?.currency || 'EUR', locale) : t('events.activities.activity.feeHelper')}
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Grid>

          {activity.fee > 0 && (
            <>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>{t('events.activities.activity.supportedPaymentMethods')}</InputLabel>
                  <Select
                    multiple
                    value={activity.supportedPaymentMethods || []}
                    label={t('events.activities.activity.supportedPaymentMethods')}
                    onChange={(e) => handlePaymentMethodsChange(e.target.value)}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => {
                          const method = paymentMethods.find((m) => m.id === value);
                          return <Chip key={value} label={method?.name || value} size="small" />;
                        })}
                      </Box>
                    )}
                  >
                    {paymentMethods.map((method) => (
                      <MenuItem key={method.id} value={method.id}>
                        {method.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {hasCardPayment && (
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

              {hasOfflinePayment && (
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

          {/* Discount Selection */}
          {discounts.length > 0 && (
            <Grid item xs={12}>
              <DiscountSelector
                discounts={discounts}
                selectedDiscountIds={activity.discountIds || []}
                onChange={(discountIds) => handleChange('discountIds', discountIds)}
                organisationId={organisation?.id || ''}
                moduleType="events"
                disabled={loading}
                label="Apply Discounts to Activity"
                currencyCode={organisation?.currency || 'EUR'}
              />
            </Grid>
          )}
        </Grid>
      </Collapse>
    </Box>
  );
};

export default EventActivityForm;
