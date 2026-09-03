/**
 * Correcting what a member wrote on an entry form.
 *
 * A club's remedy for a mistake in an answer — a pony's name spelled wrong, a
 * vaccination date a year out — which until now meant asking somebody with
 * database access. The entry itself is not editable here: this is about what
 * was *said*, not about who is entered or what they paid.
 *
 * **Every field of the form, answered or not.** The read-only view shows only
 * the answers that exist, which is right for reading and useless for editing: a
 * question the member skipped is exactly the one an administrator is most
 * likely to be filling in, and a form that hides it offers no way to.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import {
  FieldRenderer,
  applicationFieldToFieldDefinition,
  emptyValueForField,
  validateApplicationField,
} from '@aws-web-framework/components';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import { useApi } from '@aws-web-framework/orgadmin-core';

/** A field of the form, as `/application-forms/:id/with-fields` returns one. */
export interface FormField {
  id: string;
  name: string;
  label: string;
  datatype: string;
  required?: boolean;
  validation?: Record<string, unknown> | null;
  datatypeProperties?: Record<string, unknown> | null;
  options?: unknown;
}

interface EditEntryAnswersDialogProps {
  open: boolean;
  eventId: string;
  entryId: string;
  /** The activity's form. Null where it asks nothing — the name is still editable. */
  formId: string | null;
  /** The answers as they are stored, keyed by field name. */
  values: Record<string, unknown>;
  /** The entrant's name, as one string — the way it was typed. */
  entrantName: string;
  onClose: () => void;
  /** Called once the correction has been saved. */
  onSaved: () => void;
}

/** Whether the form's own rules mark this field as one that must be answered. */
export const isRequired = (field: FormField): boolean =>
  Boolean(field.required || (field.validation as { required?: boolean } | null)?.required);

const EditEntryAnswersDialog: React.FC<EditEntryAnswersDialogProps> = ({
  open,
  eventId,
  entryId,
  formId,
  values,
  entrantName,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const { execute } = useApi();

  const [fields, setFields] = useState<FormField[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Nothing to load for an activity that asks nothing; the name is still
    // worth correcting, so the dialog opens either way.
    if (!formId) {
      setFields([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const form = await execute({
        method: 'GET',
        url: `/api/orgadmin/application-forms/${formId}/with-fields`,
      });
      setFields(form?.fields ?? []);
    } catch (failure) {
      console.error('Failed to load the form:', failure);
      setFields(null);
      setError(t('events.entryDetails.answers.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [execute, formId, t]);

  /*
   * Reopened, reloaded, and re-seeded from what is stored — a dialog that kept
   * the last edit would offer somebody else's correction as though it were the
   * record.
   */
  useEffect(() => {
    if (!open) return;
    setAnswers({ ...values });
    setName(entrantName);
    void load();
  }, [open, values, entrantName, load]);

  /** Answers present but wrong for their field, by label. */
  const wrong = (fields ?? [])
    .filter((field) => validateApplicationField(field as never, answers[field.name]) !== null)
    .map((field) => field.label);

  const missing = (fields ?? [])
    .filter((field) => isRequired(field) && !answers[field.name])
    .map((field) => field.label);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await execute({
        method: 'PUT',
        url: `/api/orgadmin/events/${eventId}/entries/${entryId}/answers`,
        data: { name: name.trim(), answers },
        // Or a refusal reads as a save: `execute` answers `null` on an error
        // unless it is asked to throw.
        throwOnError: true,
      });
      onSaved();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : t('events.entryDetails.answers.saveFailed')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('events.entryDetails.answers.title')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          {t('events.entryDetails.answers.subtitle')}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading && (
          <Stack alignItems="center" sx={{ py: 4 }}>
            <CircularProgress />
          </Stack>
        )}

        {!loading && fields?.length === 0 && (
          <Typography variant="body2">{t('events.entryDetails.answers.noFields')}</Typography>
        )}

        {/*
          Who the entry is for, above the club's own questions — the same order
          the member met them in, and the commoner correction of the two: a name
          typed in a hurry, or a child entered under a parent's.

          One field, not two. The name is typed as one string and split at the
          first space only so the schema has somewhere to put it; offering
          "first" and "last" here would ask the club to maintain a split it
          never made.
        */}
        {!loading && (
          <>
            <TextField
              fullWidth
              required
              label={t('events.entryDetails.name')}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={saving}
              error={name.trim().length === 0}
              helperText={
                name.trim().length === 0 ? t('events.entryDetails.answers.nameRequired') : ' '
              }
            />
            {fields && fields.length > 0 && <Divider sx={{ my: 2 }} />}
          </>
        )}

        {/*
          The provider sits here rather than inside `DateRenderer`: in this
          monorepo Vite can load a second copy of `@mui/x-date-pickers` through
          the source alias, and a provider inside the library would belong to a
          different module instance than the pickers rendered here — its context
          would never reach them, and every date field would take the dialog
          down with "Can not find the date and time pickers localization
          context".
        */}
        {!loading && fields && fields.length > 0 && (
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
            <Stack spacing={2}>
              {fields.map((field) => (
                <FieldRenderer
                  key={field.id}
                  fieldDefinition={applicationFieldToFieldDefinition(field as never)}
                  value={answers[field.name] ?? emptyValueForField(field as never)}
                  onChange={(value: unknown) =>
                    setAnswers((previous) => ({ ...previous, [field.name]: value }))
                  }
                  required={isRequired(field)}
                  disabled={saving}
                />
              ))}
            </Stack>
          </LocalizationProvider>
        )}

        {missing.length > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {t('events.entryDetails.answers.missing', { fields: missing.join(', ') })}
          </Alert>
        )}
        {wrong.length > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {t('events.entryDetails.answers.invalid', { fields: wrong.join(', ') })}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={
            saving ||
            loading ||
            name.trim().length === 0 ||
            missing.length > 0 ||
            wrong.length > 0
          }
        >
          {saving ? t('common.messages.saving') : t('common.actions.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditEntryAnswersDialog;
