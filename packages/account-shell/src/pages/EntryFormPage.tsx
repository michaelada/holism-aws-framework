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
} from '@aws-web-framework/components';
import FormLocalizationProvider from '../components/FormLocalizationProvider';
import { useAccountApi } from '../hooks/useAccountApi';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { CatalogueEvent, CatalogueMembershipType, CartItemType } from '../types/account';

interface FormField {
  id: string;
  name: string;
  label: string;
  order: number;
  /**
   * The form builder's vocabulary — `radio`, `checkbox`, `select`,
   * `multiselect`, `file` … — not the renderer's. `applicationFieldToFieldDefinition`
   * translates it; passing it through untouched renders every field as a text box.
   */
  datatype?: string;
  /** Choices for the select-like types, stored as a plain string array. */
  options?: unknown;
  description?: string | null;
  /**
   * Required-ness arrives in **two** places and either can carry it.
   *
   * `required` comes from `application_form_fields` — the join row, i.e. "this
   * field is required *on this form*". `validation.required` comes from the
   * field definition itself, which is shared between forms. A field can be
   * mandatory by either route, and in practice the join column is the one the
   * form builder writes while `validation` is left null.
   */
  required?: boolean;
  validation?: { required?: boolean };
}

/** Mandatory by either route. */
const isRequired = (field: FormField): boolean =>
  field.required === true || field.validation?.required === true;

interface ApplicationForm {
  id: string;
  name?: string;
  description?: string | null;
  fields: FormField[];
}

/**
 * Entering an event, or applying for a membership — as a page.
 *
 * **Why a page and not the dialog it replaces.** An application form is the
 * club's own, and can run to many fields across several groups; a dialog gives
 * it a scrolling box inside a scrolling page, hides the item being paid for
 * behind an overlay, and cannot be linked to, reloaded or returned to. Terms
 * and conditions make that worse — a member is being asked to agree to
 * something they cannot comfortably read.
 *
 * The item is re-fetched from the catalogue by id rather than passed through
 * router state, so the page survives a reload and a pasted link, and so the
 * price and availability shown are the server's current answer rather than
 * whatever was on the list when the member clicked.
 */
export const EntryFormPage: React.FC<{ kind: 'event' | 'membership' }> = ({ kind }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { itemId } = useParams<{ itemId: string }>();
  const { orgCode, me } = useAccountOrganisation();
  const online = useOnlineStatus();

  const { execute: executeCatalogue } = useAccountApi<any>();
  const { execute: executeForm } = useAccountApi<any>();
  const { execute: executeSubmit } = useAccountApi<{ id: string }>();
  const { execute: executeAdd } = useAccountApi<unknown>();

  const currency = me?.organisation.currency ?? 'EUR';
  const locale = i18n.language;

  const [item, setItem] = useState<any>(null);
  const [event, setEvent] = useState<CatalogueEvent | null>(null);
  const [form, setForm] = useState<ApplicationForm | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [agreed, setAgreed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [notFound, setNotFound] = useState(false);

  const backTo = `/${orgCode}/browse/${kind === 'event' ? 'events' : 'memberships'}`;

  const load = useCallback(async () => {
    if (!orgCode || !itemId) return;
    setLoading(true);
    setError(null);

    try {
      if (kind === 'event') {
        const events: CatalogueEvent[] =
          (await executeCatalogue({ url: `/api/account/${orgCode}/catalogue/events` })) ?? [];
        const parent = events.find((e) => e.activities.some((a) => a.id === itemId));
        const activity = parent?.activities.find((a) => a.id === itemId);

        if (!activity) {
          setNotFound(true);
          return;
        }
        setEvent(parent ?? null);
        setItem(activity);

        if (activity.applicationFormId) {
          setForm(
            await executeForm({
              url: `/api/account/${orgCode}/forms/${activity.applicationFormId}`,
            })
          );
        }
      } else {
        const types: CatalogueMembershipType[] =
          (await executeCatalogue({
            url: `/api/account/${orgCode}/catalogue/membership-types`,
          })) ?? [];
        const type = types.find((m) => m.id === itemId);

        if (!type) {
          setNotFound(true);
          return;
        }
        setItem(type);

        if (type.membershipFormId) {
          setForm(
            await executeForm({ url: `/api/account/${orgCode}/forms/${type.membershipFormId}` })
          );
        }
      }
    } catch {
      setError(t('form.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [orgCode, itemId, kind, executeCatalogue, executeForm, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const terms: string | null = item?.termsAndConditions ?? null;
  const fields = useMemo(
    () => (form?.fields ? [...form.fields].sort((a, b) => a.order - b.order) : []),
    [form]
  );

  /**
   * Required answers still outstanding, recomputed as the member types.
   *
   * Drives the submit button rather than only being checked on press: a member
   * who has scrolled past a required field halfway down a long form should see
   * that the button is not yet available while they are still in the form, not
   * be sent back up to it after committing to the action.
   */
  const outstanding = useMemo(
    () =>
      fields
        .filter(isRequired)
        .filter((field) => {
          const value = values[field.name];
          if (Array.isArray(value)) return value.length === 0;
          // A required tick-box that has been ticked and un-ticked holds
          // `false`, which is an answer of the wrong kind rather than an answer.
          if (value === false) return true;
          return value === undefined || value === null || value === '';
        })
        .map((field) => field.label),
    [fields, values]
  );

  /**
   * Answers that are present but wrong for their field — an email that is not
   * an email, letters in a phone number, a choice that is not on offer.
   *
   * Checked by the same `validateApplicationField` the server uses, so a form
   * that passes here is not rejected after payment has been committed to. A
   * blank optional answer is not listed: not filled in is not filled in wrongly.
   */
  const badAnswers = useMemo(
    () =>
      fields
        .filter((field) => validateApplicationField(field, values[field.name]) !== null)
        .map((field) => field.label),
    [fields, values]
  );

  const submit = async () => {
    if (!item || !orgCode) return;

    /*
     * The button is already disabled while anything is outstanding or wrong, so
     * this is the belt to that braces — it catches a submit triggered by
     * keyboard or by a stale render rather than being the member's first
     * warning.
     */
    if (outstanding.length > 0) {
      setMissing(outstanding);
      return;
    }
    if (badAnswers.length > 0) {
      setInvalid(badAnswers);
      return;
    }
    setMissing([]);
    setInvalid([]);

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
            contextId: item.id,
            submissionType: kind === 'event' ? 'event_entry' : 'membership_application',
            submissionData: values,
          },
        });
        formSubmissionId = submission?.id ?? null;
      }

      await executeAdd({
        method: 'POST',
        url: `/api/account/${orgCode}/cart/items`,
        data:
          kind === 'event'
            ? {
                itemType: 'event_entry' satisfies CartItemType,
                contextRef: { activityId: item.id, eventId: event?.id },
                description: `${event?.name ?? ''} — ${item.name}`,
                unitFee: item.fee,
                handlingFeeIncluded: item.handlingFeeIncluded,
                supportedPaymentMethodIds: item.supportedPaymentMethodIds,
                formSubmissionId,
              }
            : {
                itemType: 'membership' satisfies CartItemType,
                contextRef: { membershipTypeId: item.id },
                description: item.name,
                unitFee: item.fee,
                handlingFeeIncluded: item.handlingFeeIncluded,
                supportedPaymentMethodIds: item.supportedPaymentMethodIds,
                formSubmissionId,
              },
      });

      // Straight to the basket: the member has just committed to something with
      // a price, and the next thing they need is the total.
      navigate(`/${orgCode}/cart`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('form.saveFailed'));
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

  if (notFound || !item) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert severity="error">{t('form.itemNotFound')}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(backTo)} sx={{ mt: 2 }}>
          {t('form.back')}
        </Button>
      </Container>
    );
  }

  const termsRequired = Boolean(terms);
  const canSubmit =
    online &&
    !saving &&
    (!termsRequired || agreed) &&
    outstanding.length === 0 &&
    badAnswers.length === 0;

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(backTo)} sx={{ mb: 2 }}>
        {t('form.back')}
      </Button>

      {/* What is being entered, and what it costs, stays visible throughout. */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h1" gutterBottom>
          {kind === 'event' ? event?.name : item.name}
        </Typography>
        {kind === 'event' && (
          <Typography variant="h2" color="text.secondary" gutterBottom>
            {item.name}
          </Typography>
        )}
        {item.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {item.description}
          </Typography>
        )}
        <Typography variant="h6">{formatCurrency(item.fee / 100, currency, locale)}</Typography>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {missing.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('form.missingRequired', { fields: missing.join(', ') })}
        </Alert>
      )}
      {invalid.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('form.checkAnswers', { fields: invalid.join(', ') })}
        </Alert>
      )}

      {form && (
        <Paper sx={{ p: 3, mb: 3 }}>
          {/*
            The club's own form name and description are deliberately not shown.
            They are written for the administrator building the form — "Event
            entry form v2", "used for all junior classes" — and mean nothing to
            the member filling it in, who needs an instruction rather than a
            label.
          */}
          <Typography variant="h2" gutterBottom>
            {t('form.detailsHeading')}
          </Typography>

          {/*
            The date/time pickers a form may contain read their locale from
            this context and throw without it — taking the whole page down to a
            blank screen, not just the one field. See FormLocalizationProvider
            for why the shared library cannot supply it itself.
          */}
          <FormLocalizationProvider>
            <Stack spacing={2}>
              {fields.map((field) => (
                <FieldRenderer
                  key={field.id}
                  /*
                   * The form builder and the renderer disagree on names,
                   * datatypes and where options live, and every one of those
                   * disagreements fails silently as a plain text box with no
                   * label. `applicationFieldToFieldDefinition` is the single
                   * translation both this page and the org-admin form preview
                   * use — see its docs for what each mismatch looks like.
                   */
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

      {terms && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h2" gutterBottom>
            {t('form.termsHeading')}
          </Typography>

          {/*
            The terms are given room and scroll on their own rather than being
            summarised behind a link. A member is about to say they have read
            them, so they have to be readable without leaving the page.
          */}
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
            {/*
              Terms are written in a rich-text editor and stored as HTML, so
              rendering them as text shows the member the tags. `RichText`
              sanitises before rendering.
            */}
            <RichText html={terms} sx={{ fontSize: '0.875rem' }} />
          </Box>

          <Divider sx={{ mb: 2 }} />

          <FormControlLabel
            control={
              <Checkbox
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
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
          {saving ? t('form.saving') : t('form.addToBasket')}
        </Button>
      </Stack>

      {/*
        Why the button is disabled. A dead control with no explanation reads as
        a broken page, and on a long form the missing field may be off-screen —
        so it is named rather than merely counted.
      */}
      {!online && (
        <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 1 }}>
          {t('offline.actionBlocked')}
        </Typography>
      )}
      {online && outstanding.length > 0 && (
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          textAlign="right"
          sx={{ mt: 1 }}
        >
          {t('form.stillRequired', { fields: outstanding.join(', ') })}
        </Typography>
      )}
      {/*
        Named for the same reason, and separately: "still needed" and "wrong"
        are different instructions, and a member told only that something is
        missing will go looking for an empty box that isn't there.
      */}
      {badAnswers.length > 0 && (
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          textAlign="right"
          sx={{ mt: 1 }}
        >
          {t('form.checkAnswers', { fields: badAnswers.join(', ') })}
        </Typography>
      )}
      {outstanding.length === 0 && badAnswers.length === 0 && termsRequired && !agreed && (
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          textAlign="right"
          sx={{ mt: 1 }}
        >
          {t('form.mustAgree')}
        </Typography>
      )}
    </Container>
  );
};

export default EntryFormPage;
