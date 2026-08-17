import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  FieldRenderer,
  applicationFieldToFieldDefinition,
  emptyValueForField,
  validateApplicationField,
} from '@aws-web-framework/components';
import FormLocalizationProvider from './FormLocalizationProvider';
import { useAccountApi } from '../hooks/useAccountApi';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';

/**
 * The application form a club attaches to an activity or membership type.
 *
 * This exists because **a membership cannot be created without one**:
 * `members.form_submission_id` is NOT NULL, so a basket line with no submission
 * is paid for and then fails at fulfilment. Collecting the answers before the
 * item enters the basket is what closes that gap.
 *
 * The submission is created first and the item is added with its id, rather
 * than the other way round. An orphaned submission is harmless — a row nobody
 * references — whereas a basket line pointing at a submission that failed to
 * save is an order that cannot be fulfilled.
 */

interface FormField {
  id: string;
  name: string;
  label: string;
  datatype: string;
  order: number;
  validation?: { required?: boolean };
  options?: unknown;
}

interface ApplicationForm {
  id: string;
  name: string;
  description?: string | null;
  fields: FormField[];
}

export interface ApplicationFormDialogProps {
  /**
   * Set to edit answers that already exist rather than collect new ones.
   *
   * The form and the previous answers are read from the submission itself, so
   * `formId` and `contextId` are only consulted when creating. Editing is
   * limited to a basket the member has not checked out — the server enforces
   * that, and refuses anything else as not found.
   */
  submissionId?: string;
  open: boolean;
  formId: string;
  /** The activity or membership type the answers belong to. */
  contextId: string;
  submissionType: 'event_entry' | 'membership_application';
  title: string;
  onCancel: () => void;
  /** Called with the new submission's id once the answers are saved. */
  onSubmitted: (formSubmissionId: string) => void;
}

export const ApplicationFormDialog: React.FC<ApplicationFormDialogProps> = ({
  open,
  submissionId,
  formId,
  contextId,
  submissionType,
  title,
  onCancel,
  onSubmitted,
}) => {
  const { t } = useTranslation();
  const { orgCode } = useAccountOrganisation();
  const { execute } = useAccountApi<ApplicationForm>();
  const { execute: executeSubmit } = useAccountApi<{ id: string }>();

  const [form, setForm] = useState<ApplicationForm | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!orgCode || !open) return;
    setLoading(true);
    setError(null);
    try {
      /*
       * Editing reads the submission, which carries both the form and what was
       * answered; creating reads the form alone. Kept as one loader so the two
       * paths cannot drift into rendering different things.
       */
      const response = submissionId
        ? await execute({ url: `/api/account/${orgCode}/form-submissions/${submissionId}` })
        : null;
      const result = submissionId
        ? (response as any)?.form
        : await execute({ url: `/api/account/${orgCode}/forms/${formId}` });
      /*
       * Normalised rather than trusted. `fields` is spread and sorted during
       * render, so a response without it throws inside the render pass and
       * takes the dialog down with no message — the member sees the button do
       * nothing at all.
       */
      setForm({
        id: result?.id ?? formId,
        name: result?.name ?? '',
        description: result?.description ?? null,
        fields: Array.isArray(result?.fields) ? result.fields : [],
      });
      // Prefilled when editing, so the member corrects rather than retypes.
      setValues(submissionId ? ((response as any)?.submissionData ?? {}) : {});
      setMissing([]);
    } catch {
      setError(t('form.loadFailed'));
      setForm(null);
    } finally {
      setLoading(false);
    }
  }, [execute, orgCode, formId, submissionId, open, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!form || !orgCode) return;

    /*
     * Answers are checked here as well as on the server, by the same rules —
     * `validateApplicationField` is what the endpoint uses too. The server
     * would reject a bad submission anyway, but only after the member has
     * pressed the button; naming the fields is more useful than a rejection.
     */
    const unanswered = form.fields
      .filter(
        (field) =>
          validateApplicationField(field, values[field.name], field.validation?.required) !== null
      )
      .map((field) => field.label);

    if (unanswered.length > 0) {
      setMissing(unanswered);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (submissionId) {
        await executeSubmit({
          method: 'PUT',
          url: `/api/account/${orgCode}/form-submissions/${submissionId}`,
          data: { submissionData: values },
        });
        onSubmitted(submissionId);
      } else {
        const submission = await executeSubmit({
          method: 'POST',
          url: `/api/account/${orgCode}/form-submissions`,
          data: { formId, contextId, submissionType, submissionData: values },
        });
        onSubmitted(submission.id);
      }
    } catch {
      setError(t('form.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onCancel} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 4 }}>
            <CircularProgress aria-label={t('common.loading')} />
          </Stack>
        ) : error && !form ? (
          <Alert severity="error">{error}</Alert>
        ) : form ? (
          <FormLocalizationProvider>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {form.description && (
                <Typography variant="body2" color="text.secondary">
                  {form.description}
                </Typography>
              )}

              {error && <Alert severity="error">{error}</Alert>}
              {missing.length > 0 && (
                <Alert severity="warning">
                  {t('form.missingRequired', { fields: missing.join(', ') })}
                </Alert>
              )}

              {[...form.fields]
                .sort((a, b) => a.order - b.order)
                .map((field) => (
                  <FieldRenderer
                    key={field.id}
                    /* Builder vocabulary → renderer vocabulary; see the helper. */
                    fieldDefinition={applicationFieldToFieldDefinition(field)}
                    value={values[field.name] ?? emptyValueForField(field)}
                    onChange={(value: unknown) =>
                      setValues((previous) => ({ ...previous, [field.name]: value }))
                    }
                    disabled={saving}
                  />
                ))}
            </Stack>
          </FormLocalizationProvider>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" onClick={submit} disabled={saving || !form}>
          {saving ? t('form.saving') : t('form.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ApplicationFormDialog;
