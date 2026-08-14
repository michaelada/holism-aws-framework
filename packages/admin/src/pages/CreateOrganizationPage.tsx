import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getOrganizationTypes,
  getCapabilities,
  createOrganization,
  getPaymentMethods,
  checkUrlCodeAvailability,
} from '../services/organizationApi';
import type {
  OrganizationType,
  Capability,
  CreateOrganizationDto,
} from '../types/organization.types';
import type { PaymentMethod } from '../types/payment-method.types';
import { useNotification } from '../context/NotificationContext';
import { CapabilitySelector } from '../components/CapabilitySelector';
import { PaymentMethodSelector } from '../components/PaymentMethodSelector';
import { PageHeader } from '../components/PageHeader';
import { FormSection } from '../components/FormSection';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { LOCALES } from '../constants/localisation';

export const CreateOrganizationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showSuccess, showError } = useNotification();

  const [organizationTypes, setOrganizationTypes] = useState<OrganizationType[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [urlCodeError, setUrlCodeError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const preselectedTypeId = searchParams.get('typeId');

  const initialForm: CreateOrganizationDto = useMemo(
    () => ({
      organizationTypeId: preselectedTypeId || '',
      name: '',
      displayName: '',
      domain: '',
      contactName: '',
      contactEmail: '',
      contactMobile: '',
      urlCode: '',
      // No currency here — it is inherited from the organisation type (G12).
      language: 'en-GB',
      enabledCapabilities: [],
      enabledPaymentMethods: ['pay-offline'], // Default to pay-offline
      settings: {
        address: '',
        city: '',
        postcode: '',
        country: 'Ireland',
        phone: '',
        website: '',
      },
    }),
    [preselectedTypeId]
  );

  const [formData, setFormData] = useState<CreateOrganizationDto>(initialForm);

  const isDirty = useMemo(
    () => JSON.stringify(formData) !== JSON.stringify(initialForm),
    [formData, initialForm]
  );
  const { guard, promptOpen, confirmDiscard, cancelDiscard } = useUnsavedChanges(isDirty);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Update form data if typeId is provided in URL
    if (preselectedTypeId && formData.organizationTypeId === '') {
      setFormData((prev) => ({
        ...prev,
        organizationTypeId: preselectedTypeId,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedTypeId, organizationTypes]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [typesData, capsData, paymentMethodsData] = await Promise.all([
        getOrganizationTypes(),
        getCapabilities(),
        getPaymentMethods(),
      ]);
      setOrganizationTypes(typesData);
      setCapabilities(capsData);
      setPaymentMethods(paymentMethodsData);
    } catch (error) {
      showError('Failed to load data');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Validates every field at once and marks each offender.
   *
   * Validation used to be a sequence of toasts: submit, get told the type is
   * missing, fix it, submit again, get told the name is missing. A form with
   * three problems cost three round trips and no field was ever marked as the
   * one at fault.
   */
  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!formData.organizationTypeId) {
      next.organizationTypeId = 'Choose the type this organisation belongs to';
    }
    if (!formData.name.trim()) next.name = 'A URL-friendly name is required';
    if (!formData.displayName.trim()) next.displayName = 'A display name is required';
    if (formData.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      next.contactEmail = 'Enter a complete email address, for example name@club.ie';
    }
    if (urlCodeError) next.urlCode = urlCodeError;

    setErrors(next);
    const firstInvalid = Object.keys(next)[0];
    if (firstInvalid) {
      const field = document.querySelector<HTMLElement>(`[name="${firstInvalid}"]`);
      field?.focus();
      field?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return firstInvalid === undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      const created = await createOrganization(formData);

      // Land on the organisation just created rather than a list row that looks
      // like every other row, and hand over the member link the form already
      // computed — it is the thing the operator has to pass to the club.
      const code = created?.urlCode ?? formData.urlCode ?? formData.name;
      showSuccess(`${formData.displayName} created. Members sign in at /account/${code}`);

      if (created?.id) {
        navigate(`/organizations/${created.id}`);
      } else if (preselectedTypeId) {
        navigate(`/organization-types/${preselectedTypeId}`);
      } else {
        navigate('/organizations');
      }
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to create organisation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: keyof CreateOrganizationDto, value: any) => {
    // Sanitize name field to be URL-friendly
    if (field === 'name') {
      value = value
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-') // Replace non-alphanumeric chars with hyphens
        .replace(/-+/g, '-'); // Replace multiple hyphens with single hyphen
      // Trailing hyphens survive until submit. Stripping them on every
      // keystroke meant a typed space was converted to a hyphen and then
      // immediately deleted as trailing, so "my org" collapsed to "myorg" and
      // a normal name could not be typed at all.
    }
    setErrors((prev) => {
      if (!prev[field as string]) return prev;
      const next = { ...prev };
      delete next[field as string];
      return next;
    });
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSettingsChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        [field]: value,
      },
    }));
  };

  const handleCancel = () =>
    guard(() => {
      if (preselectedTypeId) {
        navigate(`/organization-types/${preselectedTypeId}`);
      } else {
        navigate('/organizations');
      }
    });

  const selectedType = organizationTypes.find((t) => t.id === formData.organizationTypeId);

  // Check the code as it is typed. Debounced because this fires per keystroke,
  // and skipped when empty since the backend will derive one.
  useEffect(() => {
    const code = formData.urlCode?.trim();
    if (!code) {
      setUrlCodeError(null);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await checkUrlCodeAvailability(code);
        if (!cancelled) {
          setUrlCodeError(result.available ? null : result.reason ?? 'Unavailable');
        }
      } catch {
        // A failed check must not block the form — the backend validates on
        // save regardless.
        if (!cancelled) setUrlCodeError(null);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formData.urlCode]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
          Loading…
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Create Organisation"
        description="A club or association. It inherits its currency and default capabilities from its type."
        onBack={handleCancel}
        backLabel="Back without creating"
      />

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <FormSection
          title="Type"
          description="Everything below inherits from this choice, so it comes first."
        >
          <FormControl fullWidth required error={Boolean(errors.organizationTypeId)}>
            <InputLabel id="org-type-label">Organisation Type</InputLabel>
            <Select
              labelId="org-type-label"
              name="organizationTypeId"
              value={formData.organizationTypeId}
              label="Organisation Type"
              onChange={(e) => handleChange('organizationTypeId', e.target.value)}
              disabled={!!preselectedTypeId}
            >
              {organizationTypes.map((type) => (
                <MenuItem key={type.id} value={type.id}>
                  {type.displayName}
                </MenuItem>
              ))}
            </Select>
            {errors.organizationTypeId && (
              <FormHelperText>{errors.organizationTypeId}</FormHelperText>
            )}
          </FormControl>

          <TextField
            fullWidth
            label="Currency"
            value={selectedType?.currency ?? ''}
            InputProps={{ readOnly: true }}
            disabled={!selectedType}
            helperText={
              selectedType
                ? `Set by the ${selectedType.displayName} organisation type`
                : 'Select an organisation type first'
            }
          />
        </FormSection>

        <FormSection title="Identity" description="How this organisation is named and addressed.">
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                name="displayName"
                label="Display Name"
                value={formData.displayName}
                onChange={(e) => handleChange('displayName', e.target.value)}
                error={Boolean(errors.displayName)}
                helperText={errors.displayName ?? 'Public-facing name'}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                name="name"
                label="Name (URL-friendly)"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., my-org"
                error={Boolean(errors.name)}
                helperText={errors.name ?? 'Lowercase, no spaces, hyphens allowed'}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="urlCode"
                label="Member portal code"
                value={formData.urlCode ?? ''}
                onChange={(e) => handleChange('urlCode', e.target.value)}
                placeholder="e.g., khpc"
                error={Boolean(urlCodeError || errors.urlCode)}
                helperText={
                  urlCodeError ||
                  errors.urlCode ||
                  (formData.urlCode
                    ? `Members will sign in at /account/${formData.urlCode}`
                    : 'Optional — we will derive one from the display name')
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="domain"
                label="Domain"
                value={formData.domain}
                onChange={(e) => handleChange('domain', e.target.value)}
                helperText="Optional: Organisation domain (e.g., 'example.com')"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="org-language-label">Language</InputLabel>
                <Select
                  labelId="org-language-label"
                  name="language"
                  value={formData.language}
                  label="Language"
                  onChange={(e) => handleChange('language', e.target.value)}
                >
                  {LOCALES.map((locale) => (
                    <MenuItem key={locale.code} value={locale.code}>
                      {locale.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </FormSection>

        <FormSection
          title="Primary contact"
          description="Who to reach at this organisation. All optional."
        >
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                name="contactName"
                label="Contact Name"
                value={formData.contactName}
                onChange={(e) => handleChange('contactName', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                name="contactEmail"
                label="Contact Email"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => handleChange('contactEmail', e.target.value)}
                error={Boolean(errors.contactEmail)}
                helperText={errors.contactEmail}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                name="contactMobile"
                label="Contact Mobile Number"
                value={formData.contactMobile}
                onChange={(e) => handleChange('contactMobile', e.target.value)}
              />
            </Grid>
          </Grid>
        </FormSection>

        <FormSection title="Address" description="Optional. Appears on receipts and emails.">
          <Grid container spacing={2.5}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                value={formData.settings?.address || ''}
                onChange={(e) => handleSettingsChange('address', e.target.value)}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="City"
                value={formData.settings?.city || ''}
                onChange={(e) => handleSettingsChange('city', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Postcode"
                value={formData.settings?.postcode || ''}
                onChange={(e) => handleSettingsChange('postcode', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Country"
                value={formData.settings?.country || ''}
                onChange={(e) => handleSettingsChange('country', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Phone"
                type="tel"
                value={formData.settings?.phone || ''}
                onChange={(e) => handleSettingsChange('phone', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Website"
                type="url"
                value={formData.settings?.website || ''}
                onChange={(e) => handleSettingsChange('website', e.target.value)}
                placeholder="https://example.com"
              />
            </Grid>
          </Grid>
        </FormSection>

        {selectedType && (
          <FormSection
            title="Capabilities"
            description="What this organisation can do. The type's defaults are pre-selected; change them only where this club differs."
          >
            <CapabilitySelector
              capabilities={capabilities}
              selectedCapabilities={formData.enabledCapabilities}
              defaultCapabilities={selectedType.defaultCapabilities}
              onChange={(selected) => handleChange('enabledCapabilities', selected)}
            />
          </FormSection>
        )}

        <FormSection
          title="Payment methods"
          description="How this organisation can take money. Pay Offline is always available and never carries a handling fee."
        >
          <PaymentMethodSelector
            paymentMethods={paymentMethods}
            selectedPaymentMethods={formData.enabledPaymentMethods || []}
            onChange={(selected) => handleChange('enabledPaymentMethods', selected)}
          />
        </FormSection>

        <Card>
          <CardContent>
            <Box display="flex" gap={2} justifyContent="flex-end" alignItems="center">
              {isDirty && (
                <Typography variant="body2" color="text.secondary" sx={{ mr: 'auto' }}>
                  Unsaved changes
                </Typography>
              )}
              <Button variant="outlined" onClick={handleCancel} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create Organisation'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <ConfirmDialog
        open={promptOpen}
        title="Discard this organisation?"
        severity="error"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        message="Nothing has been created yet. Leaving now loses what you have filled in."
        onConfirm={confirmDiscard}
        onCancel={cancelDiscard}
      />
    </Box>
  );
};
