import React, { useMemo, useState, useEffect } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getCapabilities,
  getOrganizationTypeById,
  updateOrganizationType,
  getOrganizationTypePaymentFees,
  setOrganizationTypePaymentFees,
  getCardPaymentMethodDefaults,
  uploadOrganizationTypeLogo,
  deleteOrganizationTypeLogo,
} from '../services/organizationApi';
import type { Capability, UpdateOrganizationTypeDto } from '../types/organization.types';
import { useNotification } from '../context/NotificationContext';
import { CapabilitySelector } from '../components/CapabilitySelector';
import { PaymentFeeEditor, hasIncompleteRates, currencySymbol } from '../components/PaymentFeeEditor';
import type { PaymentFeeEditorMethod } from '../components/PaymentFeeEditor';
import type { CardPaymentMethodDefault } from '../types/organization.types';
import { PageHeader } from '../components/PageHeader';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FormSection } from '../components/FormSection';
import { TypeLogoSection } from '../components/TypeLogoSection';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { CURRENCIES, LANGUAGES, LOCALES } from '../constants/localisation';

type FeeLoadState = 'loading' | 'ready' | 'failed';

export const EditOrganizationTypePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();

  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentFees, setPaymentFees] = useState<PaymentFeeEditorMethod[]>([]);
  const [feeDefaults, setFeeDefaults] = useState<CardPaymentMethodDefault[]>([]);
  const [organisationCount, setOrganisationCount] = useState(0);
  const [feeState, setFeeState] = useState<FeeLoadState>('loading');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // The currency the type was loaded with. Comparing against it is what makes
  // an unlocked-but-unchanged currency safe to save without a confirmation.
  const [savedCurrency, setSavedCurrency] = useState<string>('');
  const [currencyUnlocked, setCurrencyUnlocked] = useState(false);
  const [currencyPrompt, setCurrencyPrompt] = useState(false);

  const [initialSnapshot, setInitialSnapshot] = useState('');

  const [formData, setFormData] = useState<UpdateOrganizationTypeDto & { name?: string }>({
    name: '',
    displayName: '',
    description: '',
    currency: 'USD',
    language: 'en',
    defaultLocale: 'en-GB',
    defaultCapabilities: [],
    membershipNumbering: 'internal',
    allowLogoOverride: true,
    membershipNumberUniqueness: 'organization',
    initialMembershipNumber: 1000000,
  });
  /*
   * The chosen file lives outside `formData` because it is not part of the JSON
   * save — it goes to its own multipart endpoint afterwards — and `removeLogo`
   * records the intent to clear, which is not the same as "no file chosen".
   */
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>('');

  const isDirty = useMemo(
    () => initialSnapshot !== '' && JSON.stringify(formData) !== initialSnapshot,
    [formData, initialSnapshot]
  );
  const { guard, promptOpen, confirmDiscard, cancelDiscard } = useUnsavedChanges(isDirty);

  useEffect(() => {
    if (id) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadData = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setLoadFailed(false);
      const [capsData, typeData] = await Promise.all([
        getCapabilities(),
        getOrganizationTypeById(id),
      ]);
      setCapabilities(capsData);
      const loaded = {
        name: typeData.name,
        displayName: typeData.displayName,
        description: typeData.description,
        currency: typeData.currency,
        language: typeData.language,
        defaultLocale: typeData.defaultLocale || 'en-GB',
        defaultCapabilities: typeData.defaultCapabilities,
        membershipNumbering: typeData.membershipNumbering || 'internal',
        allowLogoOverride: typeData.allowLogoOverride !== false,
        membershipNumberUniqueness: typeData.membershipNumberUniqueness || 'organization',
        initialMembershipNumber: typeData.initialMembershipNumber || 1000000,
      };
      setFormData(loaded);
      setLogoUrl(typeData.logoUrl || '');
      setSavedCurrency(typeData.currency);
      setInitialSnapshot(JSON.stringify(loaded));
    } catch (error) {
      // A failed load must not leave the page spinning forever. It reports and
      // offers a way back, so the operator is never stranded on a blank screen.
      setLoadFailed(true);
      showError('Failed to load organisation type');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handling fees are loaded separately from the type itself: they belong to a
  // different table and a failure here should not stop the page rendering.
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setFeeState('loading');
        const [feeResponse, defaults] = await Promise.all([
          getOrganizationTypePaymentFees(id),
          getCardPaymentMethodDefaults(),
        ]);
        // Guarded: a response of an unexpected shape should leave the fee
        // editor empty, not break the page it sits on.
        const fees = feeResponse?.fees ?? [];
        const count = feeResponse?.organisationCount ?? 0;
        setPaymentFees(
          fees.map((f) => ({
            paymentMethodId: f.paymentMethodId,
            displayName: f.paymentMethodDisplayName,
            fixedFee: f.fixedFee,
            percentageFee: f.percentageFee,
            taxPercentage: f.taxPercentage,
          }))
        );
        setOrganisationCount(count);
        setFeeDefaults(defaults ?? []);
        setFeeState('ready');
      } catch (error) {
        // This used to be a bare console.error. The consequence was silent and
        // serious: `paymentFees` stayed empty, the save path skipped the fee
        // write entirely, and the operator was told the type had been updated
        // successfully while never learning handling fees existed at all.
        setFeeState('failed');
        console.error('Error loading handling fees:', error);
      }
    })();
  }, [id]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!formData.name?.trim()) next.name = 'A URL-friendly name is required';
    if (!formData.displayName?.trim()) next.displayName = 'A display name is required';
    if (!formData.currency) next.currency = 'A currency is required';
    if (!formData.language) next.language = 'A language is required';
    if (!formData.defaultLocale) next.defaultLocale = 'A default locale is required';
    if (
      formData.membershipNumbering === 'internal' &&
      (!formData.initialMembershipNumber || formData.initialMembershipNumber < 1)
    ) {
      next.initialMembershipNumber = 'Enter a starting number of 1 or more';
    }
    setErrors(next);

    const firstInvalid = Object.keys(next)[0];
    if (firstInvalid) {
      // Move focus to the problem rather than announcing it somewhere the
      // operator is not looking and a screen reader never reaches.
      const field = document.querySelector<HTMLElement>(`[name="${firstInvalid}"]`);
      field?.focus();
      field?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return firstInvalid === undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!validate()) return;

    if (hasIncompleteRates(paymentFees)) {
      showError('Every handling fee needs a value. Enter 0 where a fee does not apply.');
      return;
    }

    try {
      setSubmitting(true);

      // Prepare form data - only include conditional fields for internal mode
      const submitData: UpdateOrganizationTypeDto = {
        ...formData,
      };

      // Remove conditional fields if external mode
      if (formData.membershipNumbering === 'external') {
        delete submitData.membershipNumberUniqueness;
        delete submitData.initialMembershipNumber;
      }

      await updateOrganizationType(id, submitData);

      /*
       * The logo is its own endpoint — it carries a file, not JSON — so it is
       * saved after the rest. A failure here is reported without claiming the
       * whole save failed: the name, capabilities and flag are already stored.
       */
      if (logoFile) {
        await uploadOrganizationTypeLogo(id, logoFile);
      } else if (removeLogo) {
        await deleteOrganizationTypeLogo(id);
      }

      if (paymentFees.length > 0) {
        await setOrganizationTypePaymentFees(
          id,
          paymentFees.map((f) => ({
            paymentMethodId: f.paymentMethodId,
            fixedFee: Number(f.fixedFee) || 0,
            percentageFee: Number(f.percentageFee) || 0,
            taxPercentage: Number(f.taxPercentage) || 0,
          }))
        );
      }

      setInitialSnapshot(JSON.stringify(formData));
      showSuccess(
        feeState === 'failed'
          ? 'Organisation type updated. Handling fees could not be loaded and were not saved.'
          : 'Organisation type updated successfully'
      );
      navigate('/organization-types');
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to update organisation type');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    // Sanitize name field to be URL-friendly
    if (field === 'name') {
      value = value
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-') // Replace non-alphanumeric chars with hyphens
        .replace(/-+/g, '-'); // Replace multiple hyphens with single hyphen
      // Trailing hyphens are deliberately left alone while typing. Stripping
      // them on every keystroke meant a space could never become a hyphen —
      // "my type" collapsed to "mytype" as you typed.
    }
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const leave = () => guard(() => navigate('/organization-types'));

  const currencyLocked = organisationCount > 0 && !currencyUnlocked;
  const currencyChanged = savedCurrency !== '' && formData.currency !== savedCurrency;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
          Loading organisation type…
        </Typography>
      </Box>
    );
  }

  if (loadFailed) {
    return (
      <Box>
        <PageHeader title="Edit Organisation Type" onBack={() => navigate('/organization-types')} />
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={loadData}>
              Try again
            </Button>
          }
        >
          <AlertTitle>This organisation type could not be loaded</AlertTitle>
          It may have been deleted, or the server may be unreachable.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Edit Organisation Type"
        description={formData.displayName || undefined}
        onBack={leave}
        backLabel="Back to organisation types"
      />

      {organisationCount > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <strong>
            {organisationCount} organisation{organisationCount === 1 ? '' : 's'}
          </strong>{' '}
          {organisationCount === 1 ? 'uses' : 'use'} this type. Changes here reach every one of them.
        </Alert>
      )}

      {feeState === 'failed' && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Handling fees could not be loaded</AlertTitle>
          Everything else on this page can still be saved, but card handling fees will be left
          exactly as they are. Reload the page to try again before changing fees.
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <FormSection
          title="Identity"
          description="How this type is addressed in URLs and shown to staff."
        >
          <TextField
            name="name"
            label="Name (URL-friendly)"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g., swimming-club"
            error={Boolean(errors.name)}
            helperText={errors.name ?? 'Lowercase, no spaces, hyphens allowed'}
            required
            fullWidth
          />
          <TextField
            name="displayName"
            label="Display Name"
            value={formData.displayName}
            onChange={(e) => handleChange('displayName', e.target.value)}
            error={Boolean(errors.displayName)}
            helperText={errors.displayName}
            required
            fullWidth
          />
          <TextField
            name="description"
            label="Description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            multiline
            rows={3}
            fullWidth
          />
        </FormSection>

        <FormSection
          title="Money"
          description="Currency is fixed for every organisation of this type, and the fixed element of each handling fee is a cash amount in it."
        >
          {currencyLocked ? (
            <Box>
              <TextField
                label="Currency"
                value={formData.currency}
                InputProps={{ readOnly: true }}
                helperText={`Locked because ${organisationCount} organisation${
                  organisationCount === 1 ? '' : 's'
                } already ${organisationCount === 1 ? 'uses' : 'use'} this type.`}
                fullWidth
              />
              <Button size="small" sx={{ mt: 1 }} onClick={() => setCurrencyPrompt(true)}>
                Change currency
              </Button>
            </Box>
          ) : (
            <TextField
              name="currency"
              select
              label="Currency"
              value={formData.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
              error={Boolean(errors.currency)}
              helperText={errors.currency}
              required
              fullWidth
            >
              {CURRENCIES.map((currency) => (
                <MenuItem key={currency} value={currency}>
                  {currency}
                </MenuItem>
              ))}
            </TextField>
          )}

          {currencyChanged && (
            <Alert severity="warning">
              <AlertTitle>Handling fee amounts are not converted</AlertTitle>
              Every fixed fee below keeps its number and changes meaning: {currencySymbol(savedCurrency)}
              0.25 becomes {currencySymbol(formData.currency || savedCurrency)}0.25. Check each one
              before saving.
            </Alert>
          )}

          {feeState !== 'failed' && (
            <PaymentFeeEditor
              methods={paymentFees}
              currency={formData.currency || 'EUR'}
              defaults={feeDefaults}
              organisationCount={organisationCount}
              onChange={setPaymentFees}
              disabled={submitting}
            />
          )}
        </FormSection>

        <FormSection
          title="Language and region"
          description="Defaults inherited by every organisation of this type."
        >
          <TextField
            name="language"
            select
            label="Language"
            value={formData.language}
            onChange={(e) => handleChange('language', e.target.value)}
            error={Boolean(errors.language)}
            helperText={errors.language}
            required
            fullWidth
          >
            {LANGUAGES.map((lang) => (
              <MenuItem key={lang.code} value={lang.code}>
                {lang.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            name="defaultLocale"
            select
            label="Default Locale"
            value={formData.defaultLocale}
            onChange={(e) => handleChange('defaultLocale', e.target.value)}
            error={Boolean(errors.defaultLocale)}
            helperText={
              errors.defaultLocale ??
              'The default language and regional format for organisations of this type'
            }
            required
            fullWidth
          >
            {LOCALES.map((locale) => (
              <MenuItem key={locale.code} value={locale.code}>
                {locale.name}
              </MenuItem>
            ))}
          </TextField>
        </FormSection>

        <FormSection
          title="Membership numbering"
          description="How members of these organisations are numbered."
        >
          <TextField
            name="membershipNumbering"
            select
            label="Membership Numbering"
            value={formData.membershipNumbering}
            onChange={(e) => handleChange('membershipNumbering', e.target.value)}
            helperText="Choose how membership numbers are generated"
            required
            fullWidth
          >
            <MenuItem value="internal">Internal (System Generated)</MenuItem>
            <MenuItem value="external">External (User Provided)</MenuItem>
          </TextField>

          {formData.membershipNumbering === 'internal' && (
            <>
              <TextField
                name="membershipNumberUniqueness"
                select
                label="Membership Number Uniqueness"
                value={formData.membershipNumberUniqueness}
                onChange={(e) => handleChange('membershipNumberUniqueness', e.target.value)}
                helperText="Define the scope for membership number uniqueness"
                required
                fullWidth
              >
                <MenuItem value="organization_type">Organisation Type Level</MenuItem>
                <MenuItem value="organization">Organisation Level</MenuItem>
              </TextField>

              <TextField
                name="initialMembershipNumber"
                type="number"
                label="Initial Membership Number"
                value={formData.initialMembershipNumber}
                onChange={(e) =>
                  handleChange('initialMembershipNumber', parseInt(e.target.value, 10) || '')
                }
                error={Boolean(errors.initialMembershipNumber)}
                helperText={
                  errors.initialMembershipNumber ??
                  'The starting number for sequential membership number generation'
                }
                inputProps={{ min: 1 }}
                required
                fullWidth
              />
            </>
          )}
        </FormSection>

        <FormSection
          title="Shared logo"
          description="Inherited by every organisation of this type. A federation has one mark; without this each branch uploads its own copy of it."
        >
          <TypeLogoSection
            logoUrl={removeLogo ? '' : logoUrl}
            pendingFile={logoFile}
            allowOverride={formData.allowLogoOverride !== false}
            onChooseFile={(file) => {
              setLogoFile(file);
              // Choosing a replacement supersedes a removal.
              if (file) setRemoveLogo(false);
            }}
            onRemove={() => setRemoveLogo(true)}
            onAllowOverrideChange={(allow) => handleChange('allowLogoOverride', allow)}
            busy={submitting}
          />
        </FormSection>

        <FormSection
          title="Default capabilities"
          description="Enabled automatically for every new organisation of this type. Existing organisations keep what they already have."
        >
          <CapabilitySelector
            capabilities={capabilities}
            selectedCapabilities={formData.defaultCapabilities || []}
            onChange={(selected) => handleChange('defaultCapabilities', selected)}
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
              <Button variant="outlined" onClick={leave} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={submitting}>
                {submitting ? <CircularProgress size={22} /> : 'Update Organisation Type'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <ConfirmDialog
        open={currencyPrompt}
        title="Change this type's currency?"
        severity="error"
        confirmLabel="Unlock currency"
        confirmPhrase={formData.displayName || undefined}
        message={
          <>
            Currency is not a display setting. The fixed element of every handling fee below is a
            cash amount in this currency, and changing it re-denominates all of them without
            converting the numbers — {currencySymbol(savedCurrency)}0.25 becomes 0.25 of the new
            currency.
          </>
        }
        consequences={
          <>
            {organisationCount} organisation{organisationCount === 1 ? '' : 's'} of this type will
            charge the re-denominated handling fee on live card payments as soon as you save.
          </>
        }
        onConfirm={() => {
          setCurrencyUnlocked(true);
          setCurrencyPrompt(false);
        }}
        onCancel={() => setCurrencyPrompt(false)}
      />

      <ConfirmDialog
        open={promptOpen}
        title="Discard your changes?"
        severity="error"
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        message="This organisation type has unsaved changes. Leaving now loses them."
        onConfirm={confirmDiscard}
        onCancel={cancelDiscard}
      />
    </Box>
  );
};
