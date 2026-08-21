import React from 'react';
import {
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { auditFieldLabel } from '../../utils/auditLabels';

/** What the server writes: a field diff, or a whole row for a create/delete. */
export type AuditChangeSet = Record<string, unknown> | null | undefined;

export interface AuditChangesProps {
  changes: AuditChangeSet;
  labels: {
    field: string;
    before: string;
    after: string;
    createdWith: string;
    deletedValues: string;
    hidden: string;
    noChanges: string;
  };
  /** Formats a value for display. Currency and dates are the caller's business. */
  formatValue?: (field: string, value: unknown) => string;

  /**
   * Turns a stored field name into the words a reader knows it by.
   *
   * Defaults to the shared label map, which is English. The org-admin passes a
   * resolver that consults the translations first — the same field is
   * "Confirmation email message" on one screen and "Message de confirmation"
   * on another, and neither should be `confirmationMessage`.
   */
  formatField?: (field: string) => string;
}

const REDACTED = '[redacted]';

/** `{ from, to }` is a field diff; anything else is a plain value. */
const isDiff = (value: unknown): value is { from: unknown; to: unknown } =>
  typeof value === 'object' && value !== null && 'from' in value && 'to' in value;

/**
 * A timestamp as the server stores it, which is not how anybody reads one.
 *
 * `2026-09-19T17:23:46.254Z` next to `2026-09-19T16:23:46.254Z` is a wall of
 * identical characters with one digit different — precisely the comparison a
 * reader is here to make, rendered as hard as possible. Shown in the reader's
 * own timezone, because that is the clock the change was made against.
 */
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const formatAuditValue = (_field: string, value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  if (value instanceof Date) return value.toLocaleString();

  if (typeof value === 'string') {
    // Date-only stays date-only: rendering a birthday as a midnight timestamp
    // invents a precision the value never had.
    if (ISO_DATE.test(value)) return new Date(`${value}T00:00:00`).toLocaleDateString();
    if (ISO_TIMESTAMP.test(value)) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString();
    }
  }

  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const defaultFormat = formatAuditValue;

/**
 * What changed, as a reader wants to see it.
 *
 * The reason the audit trail exists at all: "the fee went from €25 to €30" is
 * the answer to "was that change reasonable?", and two thirty-field objects
 * side by side is not — a reader would have to diff them by eye.
 *
 * Shared, because the Platform Admin and org-admin viewers must show the same
 * record the same way. A club reading its own trail and a super admin reading
 * the platform's should never be looking at two renderings of one event.
 *
 * A redacted value is shown as a **lock**, not as a blank: "this field changed
 * and we are not showing you to what" is information, where an empty cell reads
 * as "this field was not touched".
 *
 * See docs/AUDIT_TRAIL_AND_SESSIONS.md §2.4.
 */
export const AuditChanges: React.FC<AuditChangesProps> = ({
  changes,
  labels,
  formatValue = defaultFormat,
  formatField = auditFieldLabel,
}) => {
  if (!changes || Object.keys(changes).length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {labels.noChanges}
      </Typography>
    );
  }

  const value = (field: string, raw: unknown) =>
    raw === REDACTED ? (
      <Chip
        size="small"
        icon={<LockIcon fontSize="small" />}
        label={labels.hidden}
        variant="outlined"
      />
    ) : (
      <Box component="span" sx={{ wordBreak: 'break-word' }}>
        {formatValue(field, raw)}
      </Box>
    );

  /*
   * A create and a delete carry the whole row rather than a diff — there is no
   * "before" to compare a creation against, and a delete record holding only an
   * id answers nothing.
   */
  const whole = (changes.created ?? changes.deleted) as Record<string, unknown> | undefined;
  if (whole && typeof whole === 'object') {
    return (
      <>
        <Typography variant="subtitle2" gutterBottom>
          {changes.created ? labels.createdWith : labels.deletedValues}
        </Typography>
        <Table size="small">
          <TableBody>
            {Object.entries(whole).map(([field, raw]) => (
              <TableRow key={field}>
                <TableCell sx={{ width: '35%', fontWeight: 500 }}>{formatField(field)}</TableCell>
                <TableCell>{value(field, raw)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </>
    );
  }

  const fields = Object.entries(changes).filter(([, raw]) => isDiff(raw));

  if (fields.length === 0) {
    // Something was recorded that is neither a diff nor a create/delete —
    // shown raw rather than dropped, because losing it would be worse.
    return (
      <Box component="pre" sx={{ m: 0, fontSize: '0.8125rem', whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(changes, null, 2)}
      </Box>
    );
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ width: '30%' }}>{labels.field}</TableCell>
          <TableCell sx={{ width: '35%' }}>{labels.before}</TableCell>
          <TableCell sx={{ width: '35%' }}>{labels.after}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {fields.map(([field, raw]) => {
          const change = raw as { from: unknown; to: unknown };
          return (
            <TableRow key={field}>
              <TableCell sx={{ fontWeight: 500 }}>{formatField(field)}</TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>{value(field, change.from)}</TableCell>
              <TableCell>{value(field, change.to)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default AuditChanges;
