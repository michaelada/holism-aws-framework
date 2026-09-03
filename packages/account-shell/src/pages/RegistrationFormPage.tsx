import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  FieldRenderer,
  RichText,
  applicationFieldToFieldDefinition,
  emptyValueForField,
  formatCurrency,
  validateApplicationField,
} from '@itsplainsailing/components';
import FormLocalizationProvider from '../components/FormLocalizationProvider';
import { useAccountApi } from '../hooks/useAccountApi';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { CatalogueRegistrationType, CartItemType } from '../types/account';

interface FormField {
  id: string;
  name: string;
  label: string;
  order: number;
  required?: boolean;
  validation?: { required?: boolean } | null;
  datatype?: string;
  options?: unknown;
  description?: string | null;
}

interface ApplicationForm {
  id: string;
  fields: FormField[];
}

const isRequired = (field: FormField): boolean =>
  field.required === true || field.validation?.required === true;

/**
 * D8 — registering one thing.
 *
 * **The name of the thing is a first-class field**, not one of the club's form
 * questions. `registrations.entity_name` is NOT NULL and is what the club, the
 * member and every list identify the record by — "Rocket", not "registration
 * #48". A club that also wants the horse's age asks for it on its own form;
 * the name is asked for here, by the club's own word for the thing.
 *
 * A club that reviews its registrations says so before payment. Paying and
 * *then* discovering there is a wait is the complaint this avoids.
 */
export const RegistrationFormPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { typeId } = useParams<{ typeId: string }>();
  const { orgCode, me } = useAccountOrganisation();
  const online = useOnlineStatus();

  const { execute: executeCatalogue } = useAccountApi<CatalogueRegistrationType[]>();
  const { execute: executeForm } = useAccountApi<ApplicationForm>();
  const { execute: executeSubmit } = useAccountApi<{ id: string }>();
  const { execute: executeAdd } = useAccountApi<unknown>();

  const currency = me?.organisation.currency ?? 'EUR';
  const locale = i18n.language;

  const [type, setType] = useState<CatalogueRegistrationType | null>(null);
  const [form, setForm] = useState<ApplicationForm | null>(null);
  const [entityName, setEntityName] = useState('');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [agreed, setAgreed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backTo = `/${orgCode}/register-interest`;

  const load = useCallback(async () => {
    if (!orgCode || !typeId) return;
    setLoading(true);
    setError(null);
    try {
      const types =
        (await executeCatalogue({ url: `/api/account/${orgCode}/catalogue/registration-types` })) ??
        [];
      const found = types.find((candidate) => candidate.id === typeId) ?? null;

      if (!found) {
        setNotFound(true);
        return;
      }
      setType(found);

      if (found.registrationFormId) {
        setForm(
          await executeForm({ url: `/api/account/${orgCode}/forms/${found.registrationFormId}` })
        );
      }
    } catch {
      setError(t('registrations.loadError'));
    } finally {
      setLoading(false);
    }
  }, [orgCode, typeId, executeCatalogue, executeForm, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const fields = useMemo(
    () => (form?.fields ? [...form.fields].sort((a, b) => a.order - b.order) : []),
    [form]
  );

  const outstanding = useMemo(
    () =>
      fields
        .filter(
          (field) => validateApplicationField(field, values[field.name], isRequired(field)) !== null
        )
        .map((field) => field.label),
    [fields, values]
  );

  const termsRequired = Boolean(type?.termsAndConditions);
  const named = entityName.trim().length > 0;
  const canSubmit =
    online &&
    !saving &&
    type !== null &&
    type.available &&
    named &&
    outstanding.length === 0 &&
    (!termsRequired || agreed);

  const submit = async () => {
    if (!type || !orgCode) return;
    setSaving(true);
    setError(null);

    try {
      let formSubmissionId: string | null = null;

      if (form) {
        const submission = await executeSubmit({
          method: 'POST',
          url: `/api/account/${orgCode}/form-submissions`,
          data: {
            formId: form.id,
            contextId: type.id,
            submissionType: 'registration',
            submissionData: values,
          },
        });
        formSubmissionId = submission?.id ?? null;
      }

      await executeAdd({
        method: 'POST',
        url: `/api/account/${orgCode}/cart/items`,
        data: {
          itemType: 'registration' satisfies CartItemType,
          contextRef: { registrationTypeId: type.id, entityName: entityName.trim() },
          // The name is in the description too: it is what the member will
          // recognise in the basket, where "Horse registration 2026" alone
          // would not distinguish one horse from another.
          description: `${type.name} — ${entityName.trim()}`,
          unitFee: type.fee,
          handlingFeeIncluded: type.handlingFeeIncluded,
          supportedPaymentMethodIds: type.supportedPaymentMethodIds,
          formSubmissionId,
        },
      });

      navigate(`/${orgCode}/cart`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('registrations.addFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress aria-label={t('common.loading')} />
      </Box>
    );
  }

  if (notFound || !type) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert severity="error">{t('registrations.typeNotFound')}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(backTo)} sx={{ mt: 2 }}>
          {t('registrations.back')}
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(backTo)} sx={{ mb: 2 }}>
        {t('registrations.back')}
      </Button>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h1" gutterBottom>
          {type.name}
        </Typography>
        {type.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {type.description}
          </Typography>
        )}
        <Typography variant="h6">
          {type.fee > 0
            ? formatCurrency(type.fee / 100, currency, locale)
            : t('registrations.free')}
        </Typography>

        {!type.automaticallyApprove && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {t('registrations.approvalNotice', { entity: type.entityName.toLowerCase() })}
          </Alert>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h2" gutterBottom>
          {t('registrations.aboutHeading', { entity: type.entityName })}
        </Typography>
        <TextField
          fullWidth
          required
          label={t('registrations.entityNameLabel', { entity: type.entityName })}
          value={entityName}
          onChange={(event) => setEntityName(event.target.value)}
          disabled={saving}
          helperText={t('registrations.entityNameHelp', { entity: type.entityName.toLowerCase() })}
        />
      </Paper>

      {form && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h2" gutterBottom>
            {t('form.detailsHeading')}
          </Typography>
          <FormLocalizationProvider>
            <Stack spacing={2}>
              {fields.map((field) => (
                <FieldRenderer
                  key={field.id}
                  fieldDefinition={applicationFieldToFieldDefinition(field)}
                  value={values[field.name] ?? emptyValueForField(field)}
                  onChange={(value: unknown) =>
                    setValues((previous) => ({ ...previous, [field.name]: value }))
                  }
                  required={isRequired(field)}
                  disabled={saving}
                />
              ))}
            </Stack>
          </FormLocalizationProvider>
        </Paper>
      )}

      {type.termsAndConditions && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h2" gutterBottom>
            {t('form.termsHeading')}
          </Typography>
          <Box
            tabIndex={0}
            sx={{
              maxHeight: 320,
              overflowY: 'auto',
              p: 2,
              mb: 2,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              backgroundColor: 'action.hover',
            }}
          >
            <RichText html={type.termsAndConditions} sx={{ fontSize: '0.875rem' }} />
          </Box>
          <Divider sx={{ mb: 2 }} />
          <FormControlLabel
            control={
              <Checkbox
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                disabled={saving}
              />
            }
            label={t('form.agreeTerms')}
          />
        </Paper>
      )}

      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button onClick={() => navigate(backTo)} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" size="large" onClick={submit} disabled={!canSubmit}>
          {saving ? t('registrations.adding') : t('registrations.addToBasket')}
        </Button>
      </Stack>

      {!online && (
        <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 1 }}>
          {t('offline.actionBlocked')}
        </Typography>
      )}
      {online && !named && (
        <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 1 }}>
          {t('registrations.nameNeeded', { entity: type.entityName.toLowerCase() })}
        </Typography>
      )}
      {named && outstanding.length > 0 && (
        <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 1 }}>
          {t('form.stillRequired', { fields: outstanding.join(', ') })}
        </Typography>
      )}
      {named && outstanding.length === 0 && termsRequired && !agreed && (
        <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 1 }}>
          {t('form.mustAgree')}
        </Typography>
      )}
    </Container>
  );
};

export default RegistrationFormPage;
