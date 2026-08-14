import React, { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
  MenuItem,
  IconButton,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getOrganizationById,
  getOrganizationTypes,
  getCapabilities,
  getPaymentMethods,
  updateOrganization,
  checkUrlCodeAvailability,
  getOrganizationApplicationFees,
  setOrganizationApplicationFees,
  getOrganizationTypePaymentFees,
} from '../services/organizationApi';
import type {
  Organization,
  OrganizationType,
  Capability,
  UpdateOrganizationDto,
  OrganisationApplicationFees,
  PaymentFeeRates,
} from '../types/organization.types';
import type { PaymentMethod } from '../types/payment-method.types';
import { useNotification } from '../context/NotificationContext';
import { CapabilitySelector } from '../components/CapabilitySelector';
import { PaymentMethodSelector } from '../components/PaymentMethodSelector';
import {
  ApplicationFeeEditor,
  ApplicationFeeDraft,
  hasHalfSetApplicationFee,
} from '../components/ApplicationFeeEditor';

/**
 * Two states, and the second one is a real closure.
 *
 * `blocked` used to sit here as a third option. Nothing in the platform ever
 * treated it differently from `inactive` — every gate tested `status =
 * 'active'` — so it was a severity the UI implied and the backend never
 * implemented. See docs/ORGANISATION_STATUS_AND_DEACTIVATION.md.
 */
const STATUSES: Array<{ value: string; label: string; help: string }> = [
  { value: 'active', label: 'Active', help: 'Members and administrators can sign in as normal.' },
  {
    value: 'inactive',
    label: 'Inactive',
    help:
      'Closed to everyone. The club disappears from the public directory, its /account link stops ' +
      'working, and its own administrators cannot sign in either. Nothing is deleted — set it back ' +
      'to Active to restore access.',
  },
];

const LANGUAGES = [
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'fr-FR', label: 'French (France)' },
  { code: 'de-DE', label: 'German (Germany)' },
  { code: 'es-ES', label: 'Spanish (Spain)' },
  { code: 'it-IT', label: 'Italian (Italy)' },
  { code: 'pt-PT', label: 'Portuguese (Portugal)' },
];

export const EditOrganizationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [urlCodeError, setUrlCodeError] = useState<string | null>(null);
  const [organizationTypes, setOrganizationTypes] = useState<OrganizationType[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [applicationFees, setApplicationFees] = useState<OrganisationApplicationFees | null>(null);
  const [applicationFeeDraft, setApplicationFeeDraft] = useState<ApplicationFeeDraft[]>([]);
  const [typeHandlingRates, setTypeHandlingRates] = useState<Record<string, PaymentFeeRates>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<UpdateOrganizationDto & { name?: string }>({
    name: '',
    displayName: '',
    domain: '',
    contactName: '',
    contactEmail: '',
    contactMobile: '',
    urlCode: '',
    status: 'active',
    language: 'en-GB',
    enabledCapabilities: [],
    enabledPaymentMethods: [],
    settings: {
      address: '',
      city: '',
      postcode: '',
      country: 'Ireland',
      phone: '',
      website: '',
    },
  });

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const [orgData, typesData, capsData, paymentMethodsData] = await Promise.all([
        getOrganizationById(id),
        getOrganizationTypes(),
        getCapabilities(),
        getPaymentMethods(),
      ]);
      setOrganization(orgData);
      setOrganizationTypes(typesData);
      setCapabilities(capsData);
      setPaymentMethods(paymentMethodsData);

      /*
       * The platform share is loaded separately and never blocks this page.
       * It belongs to a different table and its own endpoint, and an
       * organisation whose fees fail to load should still be editable — the
       * section says so rather than the whole form failing.
       */
      try {
        const fees = await getOrganizationApplicationFees(id);
        setApplicationFees(fees);
        setApplicationFeeDraft(
          fees.fees.map((f) => ({
            paymentMethodId: f.paymentMethodId,
            applicationFeeFixed: f.applicationFeeFixed,
            applicationFeePercentage: f.applicationFeePercentage,
          }))
        );

        // The handling fee stays on the type; it is read here only so the
        // worked example can say what "not set" would actually cost.
        const typeFees = await getOrganizationTypePaymentFees(orgData.organizationTypeId);
        setTypeHandlingRates(
          Object.fromEntries(
            (typeFees.fees ?? []).map((f) => [
              f.paymentMethodId,
              {
                fixedFee: Number(f.fixedFee),
                percentageFee: Number(f.percentageFee),
                taxPercentage: Number(f.taxPercentage),
              },
            ])
          )
        );
      } catch (feeError) {
        console.error('Error loading application fees:', feeError);
        setApplicationFees(null);
      }
      
      // Extract payment method names from organization's payment methods
      const selectedPaymentMethodNames = orgData.paymentMethods
        ? orgData.paymentMethods.map((pm: any) => pm.paymentMethod?.name || pm.name).filter(Boolean)
        : [];
      
      setFormData({
        name: orgData.name,
        displayName: orgData.displayName,
        domain: orgData.domain || '',
        contactName: orgData.contactName || '',
        contactEmail: orgData.contactEmail || '',
        contactMobile: orgData.contactMobile || '',
        urlCode: orgData.urlCode || '',
        status: orgData.status,
        language: orgData.language || 'en-GB',
        enabledCapabilities: orgData.enabledCapabilities,
        enabledPaymentMethods: selectedPaymentMethodNames,
        settings: {
          address: orgData.settings?.address || '',
          city: orgData.settings?.city || '',
          postcode: orgData.settings?.postcode || '',
          country: orgData.settings?.country || 'Ireland',
          phone: orgData.settings?.phone || '',
          website: orgData.settings?.website || '',
        },
      });
    } catch (error) {
      showError('Failed to load organisation');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (urlCodeError) {
      showError(`Member portal code: ${urlCodeError}`);
      return;
    }

    // Both-or-neither, enforced here as well as in the database. The failure it
    // prevents is silent: "0% plus a fixed 50c" is a plausible-looking
    // configuration that nobody meant, and the difference is revenue on every
    // sale this organisation makes.
    if (hasHalfSetApplicationFee(applicationFeeDraft)) {
      showError(
        'Set both the application fee amount and percentage, or clear both, for every payment method.'
      );
      return;
    }

    try {
      setSubmitting(true);
      await updateOrganization(id, formData);

      /*
       * The platform share is a separate endpoint and a separate table, so it
       * is saved separately. Sequential rather than concurrent: if the fee save
       * fails the organisation update has already succeeded, and the message
       * needs to say exactly that rather than implying nothing was saved.
       */
      if (applicationFees && applicationFeeDraft.length > 0) {
        try {
          await setOrganizationApplicationFees(
            id,
            applicationFeeDraft.map((d) => ({
              paymentMethodId: d.paymentMethodId,
              applicationFeeFixed:
                d.applicationFeeFixed === '' || d.applicationFeeFixed === null
                  ? null
                  : Number(d.applicationFeeFixed),
              applicationFeePercentage:
                d.applicationFeePercentage === '' || d.applicationFeePercentage === null
                  ? null
                  : Number(d.applicationFeePercentage),
            }))
          );
        } catch (feeError: any) {
          showError(
            feeError.response?.data?.error ||
              'The organisation was saved, but its platform share could not be updated.'
          );
          setSubmitting(false);
          return;
        }
      }

      showSuccess('Organisation updated successfully');
      navigate('/organizations');
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to update organisation');
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
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    }
    setFormData({ ...formData, [field]: value });
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

  // Validate the code as it is typed, excluding this organisation so its own
  // code does not read as a collision. Debounced — this fires per keystroke.
  useEffect(() => {
    const code = formData.urlCode?.trim();
    if (!code || code === organization?.urlCode) {
      setUrlCodeError(null);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await checkUrlCodeAvailability(code, id);
        if (!cancelled) {
          setUrlCodeError(result.available ? null : result.reason ?? 'Unavailable');
        }
      } catch {
        // A failed check must not block the form; the backend validates on save.
        if (!cancelled) setUrlCodeError(null);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formData.urlCode, organization?.urlCode, id]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!organization) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Organisation not found</Typography>
      </Box>
    );
  }

  const orgType = organizationTypes.find((t) => t.id === organization.organizationTypeId);

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={() => navigate('/organizations')}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4">Edit Organisation</Typography>
      </Box>

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Box display="flex" flexDirection="column" gap={3}>
              <TextField
                label="Name (URL-friendly)"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., my-org"
                helperText="Lowercase, no spaces, hyphens allowed"
                required
                fullWidth
              />

              <TextField
                label="Display Name"
                value={formData.displayName}
                onChange={(e) => handleChange('displayName', e.target.value)}
                required
                fullWidth
              />

              <TextField
                label="Organisation Type"
                value={orgType?.displayName || 'Unknown'}
                disabled
                fullWidth
                helperText="Organisation type cannot be changed"
              />

              <TextField
                label="Member portal code"
                value={formData.urlCode ?? ''}
                onChange={(e) => handleChange('urlCode', e.target.value)}
                placeholder="e.g., khpc"
                error={Boolean(urlCodeError)}
                fullWidth
                helperText={
                  urlCodeError ||
                  (formData.urlCode !== organization?.urlCode
                    ? 'Changing this breaks any link members already have to the portal'
                    : `Members sign in at /account/${formData.urlCode || ''}`)
                }
              />

              <TextField
                label="Domain (optional)"
                value={formData.domain}
                onChange={(e) => handleChange('domain', e.target.value)}
                placeholder="e.g., riverside-swim.example.com"
                fullWidth
              />

              <TextField
                label="Contact Name"
                value={formData.contactName}
                onChange={(e) => handleChange('contactName', e.target.value)}
                placeholder="Primary contact person"
                fullWidth
              />

              <TextField
                label="Contact Email"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => handleChange('contactEmail', e.target.value)}
                placeholder="contact@example.com"
                fullWidth
              />

              <TextField
                label="Contact Mobile Number"
                value={formData.contactMobile}
                onChange={(e) => handleChange('contactMobile', e.target.value)}
                placeholder="+44 7700 900000"
                fullWidth
              />

              <Box>
                <Typography variant="h6" gutterBottom>
                  Address & Contact Details
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Optional address and contact information for this organisation.
                </Typography>
              </Box>

              <TextField
                label="Address"
                value={formData.settings?.address || ''}
                onChange={(e) => handleSettingsChange('address', e.target.value)}
                multiline
                rows={2}
                fullWidth
              />

              <TextField
                label="City"
                value={formData.settings?.city || ''}
                onChange={(e) => handleSettingsChange('city', e.target.value)}
                fullWidth
              />

              <TextField
                label="Postcode"
                value={formData.settings?.postcode || ''}
                onChange={(e) => handleSettingsChange('postcode', e.target.value)}
                fullWidth
              />

              <TextField
                label="Country"
                value={formData.settings?.country || ''}
                onChange={(e) => handleSettingsChange('country', e.target.value)}
                fullWidth
              />

              <TextField
                label="Phone"
                type="tel"
                value={formData.settings?.phone || ''}
                onChange={(e) => handleSettingsChange('phone', e.target.value)}
                fullWidth
              />

              <TextField
                label="Website"
                type="url"
                value={formData.settings?.website || ''}
                onChange={(e) => handleSettingsChange('website', e.target.value)}
                placeholder="https://example.com"
                fullWidth
              />

              <FormControl fullWidth>
                <InputLabel id="org-status-label">Status</InputLabel>
                <Select
                  labelId="org-status-label"
                  name="status"
                  value={formData.status}
                  label="Status"
                  onChange={(e) => handleChange('status', e.target.value)}
                >
                  {STATUSES.map((status) => (
                    <MenuItem key={status.value} value={status.value}>
                      {status.label}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  {STATUSES.find((option) => option.value === formData.status)?.help}
                </FormHelperText>
              </FormControl>

              {/*
                Deactivating from this form is a normal save, so it does not get
                the type-the-name confirmation the list's action has. The
                warning is here instead, stating the blast radius before the
                operator reaches the save button — this is the control that
                replaced deleting an organisation.
              */}
              {formData.status === 'inactive' && organization?.status === 'active' && (
                <Alert severity="warning">
                  Saving this will close <strong>{organization.displayName}</strong> to everyone.
                  Its {organization.accountUserCount ?? 0} member
                  {(organization.accountUserCount ?? 0) === 1 ? '' : 's'} and{' '}
                  {organization.adminUserCount ?? 0} administrator
                  {(organization.adminUserCount ?? 0) === 1 ? '' : 's'} lose access immediately.
                  Everything it holds is kept.
                </Alert>
              )}

              <FormControl fullWidth>
                <InputLabel>Language</InputLabel>
                <Select
                  value={formData.language}
                  label="Language"
                  onChange={(e) => handleChange('language', e.target.value)}
                >
                  {LANGUAGES.map((lang) => (
                    <MenuItem key={lang.code} value={lang.code}>
                      {lang.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/*
                Currency is inherited from the organisation type and shown
                read-only: the type's fixed card handling fee is a cash amount
                in that currency, so the two cannot diverge (G12).
              */}
              <TextField
                fullWidth
                label="Currency"
                value={organization?.currency ?? ''}
                InputProps={{ readOnly: true }}
                helperText="Set by this organisation's type"
              />

              <Box>
                <Typography variant="h6" gutterBottom>
                  Enabled Capabilities
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Select the capabilities available for this organisation.
                </Typography>
                <CapabilitySelector
                  capabilities={capabilities}
                  selectedCapabilities={formData.enabledCapabilities || []}
                  onChange={(selected) => handleChange('enabledCapabilities', selected)}
                  defaultCapabilities={orgType?.defaultCapabilities}
                />
              </Box>

              <Box>
                <Typography variant="h6" gutterBottom>
                  Payment Methods
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Select which payment methods this organisation should have access to.
                </Typography>
                <PaymentMethodSelector
                  paymentMethods={paymentMethods}
                  selectedPaymentMethods={formData.enabledPaymentMethods || []}
                  onChange={(selected) => handleChange('enabledPaymentMethods', selected)}
                />
              </Box>

              <Box>
                <Typography variant="h6" gutterBottom>
                  Platform share
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  What Its Plain Sailing keeps from each card payment this organisation takes. It
                  does not change what the member pays — the handling fee does that, and it is set
                  on the {orgType?.displayName ?? 'organisation'} organisation type.
                </Typography>
                {applicationFees ? (
                  <ApplicationFeeEditor
                    fees={applicationFees.fees}
                    draft={applicationFeeDraft}
                    currency={applicationFees.currency}
                    organisationTypeName={applicationFees.organisationTypeName}
                    organisationName={organization?.displayName ?? 'the organisation'}
                    handlingRatesByMethod={typeHandlingRates}
                    disabled={submitting}
                    onChange={setApplicationFeeDraft}
                    onResetToTypeDefault={(paymentMethodId) => {
                      const fee = applicationFees.fees.find(
                        (f) => f.paymentMethodId === paymentMethodId
                      );
                      if (!fee) return;
                      // Copies into the draft rather than calling the reset
                      // endpoint, so it lands with the rest of the form on save
                      // and can be abandoned by cancelling.
                      setApplicationFeeDraft((prev) =>
                        prev.map((d) =>
                          d.paymentMethodId === paymentMethodId
                            ? {
                                ...d,
                                applicationFeeFixed: fee.typeDefaultFixed,
                                applicationFeePercentage: fee.typeDefaultPercentage,
                              }
                            : d
                        )
                      );
                    }}
                  />
                ) : (
                  <Alert severity="warning">
                    The platform share could not be loaded. Everything else on this page can still
                    be saved; reload to try again.
                  </Alert>
                )}
              </Box>

              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => navigate('/organizations')}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={submitting}
                >
                  {submitting ? <CircularProgress size={24} /> : 'Update Organisation'}
                </Button>
              </Box>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};
