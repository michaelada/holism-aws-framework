import React, { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { ExpandMore as ExpandIcon, History as HistoryIcon } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AuditChanges,
  auditActionLabel,
  auditFieldLabel,
  formatAuditValue,
} from '@itsplainsailing/components';
import { getAuditEvent } from '../services/auditApi';
import type { AuditEvent } from '../types/audit.types';
import { PageHeader } from '../components/PageHeader';

/**
 * One event, in full.
 *
 * The before/after table is the reason the audit trail exists — everything else
 * on this page is context for it.
 *
 * Values are formatted for a reader rather than dumped: a fee is `€25.00`, not
 * `2500`, because the question being answered is "was that change reasonable?"
 * rather than "what is in the column". The raw record stays one click away for
 * when it is a debugging session after all.
 */
export const AuditEventPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<AuditEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    getAuditEvent(id)
      .then(setEvent)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (notFound || !event) {
    return (
      <Box>
        <PageHeader title="Event" onBack={() => navigate('/audit')} backLabel="Audit log" />
        <Alert severity="error">That event could not be found.</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={auditActionLabel(event.action)}
        description={new Date(event.occurredAt).toLocaleString()}
        onBack={() => navigate('/audit')}
        backLabel="Audit log"
      />

      <Paper sx={{ p: 3, mb: 2 }}>
        <Stack spacing={2}>
          <Field label="Who">
            <Typography variant="body2">
              {event.actorDisplay ?? 'unknown'} · {event.actorUserType}
              {event.actorEmail ? ` · ${event.actorEmail}` : ''}
            </Typography>
            {event.actorKeycloakUserId && (
              <Button
                size="small"
                startIcon={<HistoryIcon />}
                sx={{ mt: 1 }}
                onClick={() => navigate(`/audit?actor=${event.actorKeycloakUserId}`)}
              >
                View their audit trail
              </Button>
            )}
          </Field>

          <Field label="Organisation">
            <Typography variant="body2">{event.organisationName ?? '—'}</Typography>
          </Field>

          <Field label="What">
            <Typography variant="body2">
              {event.entityType ? auditFieldLabel(event.entityType) : '—'}
              {event.entityLabel ? ` · ${event.entityLabel}` : ''}
            </Typography>
          </Field>

          <Field label="Outcome">
            <Chip
              size="small"
              label={event.outcome}
              color={
                event.outcome === 'success'
                  ? 'success'
                  : event.outcome === 'denied'
                    ? 'warning'
                    : 'error'
              }
            />
          </Field>

          {event.context && (
            <Field label="Where from">
              <Typography variant="body2" color="text.secondary">
                {[
                  event.context.ip,
                  event.context.application,
                  event.context.sessionId
                    ? `session ${String(event.context.sessionId).slice(0, 8)}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </Typography>
            </Field>
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Changes
        </Typography>
        <AuditChanges
          changes={event.changes}
          formatValue={formatValue}
          labels={{
            field: 'Field',
            before: 'Before',
            after: 'After',
            createdWith: 'Created with',
            deletedValues: 'Values at deletion',
            hidden: 'hidden — marked sensitive',
            noChanges: 'This event records an action rather than a change to stored values.',
          }}
        />

        <Accordion elevation={0} sx={{ mt: 2, '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandIcon />} sx={{ px: 0 }}>
            <Typography variant="body2" color="text.secondary">
              Raw record (JSON)
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0 }}>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 2,
                bgcolor: 'grey.50',
                borderRadius: 1,
                fontSize: '0.8125rem',
                overflow: 'auto',
              }}
            >
              {JSON.stringify(event, null, 2)}
            </Box>
          </AccordionDetails>
        </Accordion>
      </Paper>
    </Box>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
      {label}
    </Typography>
    <Box sx={{ flex: 1, minWidth: 240 }}>{children}</Box>
  </Box>
);

/**
 * Money in minor units is the one that actually misleads: `2500` reads as two
 * and a half thousand, and the reader is trying to judge whether a fee change
 * was reasonable.
 *
 * Matched by **word**, not by substring.
 *
 * A substring test that was case-sensitive — the obvious way to write this —
 * never fired on `entryFee`, because the capital in the middle is not the
 * lowercase `fee` it was looking for. And camelCase is exactly what arrives:
 * the audit middleware normalises both sides of every diff to it. So the field
 * name is split into words first, which also stops `accountId` from being
 * mistaken for a total.
 */
const MONEY_WORDS = new Set(['fee', 'fees', 'price', 'amount', 'total', 'cost', 'subtotal']);

const wordsOf = (field: string): string[] =>
  field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .map((word) => word.toLowerCase())
    .filter(Boolean);

const isMoney = (field: string): boolean => wordsOf(field).some((word) => MONEY_WORDS.has(word));

const formatValue = (field: string, value: unknown): string => {
  if (typeof value === 'number' && isMoney(field)) {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(
      value / 100
    );
  }
  // Everything else — dashes, booleans, timestamps, nested objects — is the
  // shared renderer's default, so both viewers read a value the same way.
  return formatAuditValue(field, value);
};

export default AuditEventPage;
