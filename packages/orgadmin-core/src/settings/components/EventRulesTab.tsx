/**
 * S0-6 — Event rules.
 *
 * A club's own settings for a discipline, and the two levels above it. The same
 * panel the platform administrator and the federation see, drawn from the same
 * `describeSettings`, so an administrator learns it once (wireframes §2).
 *
 * ## The `From` column is the feature
 *
 * Inheritance is invisible until something goes wrong, and then the only
 * question anybody asks is *"where did 20 minutes come from?"* The source is on
 * every row, answering it before it is asked — and it cannot be worked out on
 * the front end, because a club cannot see its federation's row. The server
 * sends it.
 *
 * ## A locked setting is removed, not greyed out
 *
 * Where the organisation type has fixed a value, the input is **gone** and a
 * sentence naming who set it stands in its place. That is the rule
 * ORGANISATION_TYPE_LOGO.md already settled: a disabled control explains
 * nothing, and a club left clicking at it concludes the product is broken. A
 * sentence explains everything. The server refuses a locked key with a 403
 * regardless — the screen is the courtesy, not the constraint.
 *
 * ## Only differences are sent
 *
 * `save` posts the keys this club has actually changed, never the resolved
 * values. Sending back what was inherited would freeze the club on whatever it
 * happened to inherit that day, and a later improvement to the platform default
 * would never reach it.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Lock as LockIcon, Restore as RestoreIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { describeSettings } from '@itsplainsailing/components';
import type { SettingSource } from '@itsplainsailing/components';
import { useApi } from '../../hooks/useApi';
import { useOrganisation } from '../../context/OrganisationContext';

interface EventTemplateSummary {
  id: string;
  key: string;
  displayName: string;
  shape?: { settingLabels?: Record<string, string> };
}

interface ResolvedRules {
  templateId: string;
  templateKey: string;
  settings: Record<string, unknown>;
  sources: Record<string, SettingSource>;
  locked: string[];
}

const FROM_KEYS: Record<SettingSource, string> = {
  template: 'settings.eventRules.from.template',
  'organisation-type': 'settings.eventRules.from.organisationType',
  organisation: 'settings.eventRules.from.organisation',
};

const EventRulesTab: React.FC = () => {
  const { execute } = useApi();
  const { t } = useTranslation();
  const { organisation } = useOrganisation();

  const [templates, setTemplates] = useState<EventTemplateSummary[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [rules, setRules] = useState<ResolvedRules | null>(null);
  /** Only the keys this club is changing. Never the resolved values. */
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [loadingRules, setLoadingRules] = useState(false);
  const [saving, setSaving] = useState(false);
  /*
   * Held as a key, not a translated string: `load` is a `useCallback` the mount
   * effect depends on, and `t` is not a stable reference under every i18n
   * setup, so depending on it re-runs the effect for ever (CLAUDE.md §3.4).
   */
  const [errorKey, setErrorKey] = useState<string | null>(null);
  /** The API's own words, shown in preference to the generic key above. */
  const [errorText, setErrorText] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setErrorKey(null);
      setErrorText(null);
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/organisation/event-templates',
        throwOnError: true,
      });
      const list: EventTemplateSummary[] = Array.isArray(response) ? response : [];
      setTemplates(list);
      setTemplateId((current) => current || list[0]?.id || '');
    } catch (err: any) {
      setErrorKey('settings.eventRules.messages.loadFailed');
      setErrorText(err?.message ?? null);
    } finally {
      setLoading(false);
    }
  }, [execute]);

  const loadRules = useCallback(
    async (id: string) => {
      try {
        setLoadingRules(true);
        setErrorKey(null);
        setErrorText(null);
        const response = await execute({
          method: 'GET',
          url: `/api/orgadmin/organisation/event-rules/${id}`,
          throwOnError: true,
        });
        setRules(response);
        // Start from "nothing changed" — an override is what the administrator
        // does next, not what they inherited.
        setOverrides({});
      } catch (err: any) {
        setRules(null);
        setErrorKey('settings.eventRules.messages.loadFailed');
        setErrorText(err?.message ?? null);
      } finally {
        setLoadingRules(false);
      }
    },
    [execute]
  );

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (templateId) void loadRules(templateId);
  }, [templateId, loadRules]);

  const template = templates.find((candidate) => candidate.id === templateId);

  /** What each row currently shows: this club's edit, or the resolved value. */
  const shown = useMemo(
    () => ({ ...(rules?.settings ?? {}), ...overrides }),
    [rules, overrides]
  );

  const groups = useMemo(
    () =>
      describeSettings({
        settings: shown,
        sources: rules?.sources,
        locked: rules?.locked,
        labels: template?.shape?.settingLabels,
      }),
    [shown, rules, template]
  );

  /** A row is "changed here" when this club's own level supplied the value. */
  const changedHere = (key: string) =>
    key in overrides || rules?.sources?.[key] === 'organisation';

  const setValue = (key: string, value: unknown) => {
    setOverrides((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  /**
   * Reset one row.
   *
   * An explicit `null` marks "remove this club's value", which is not the same
   * as dropping the key from the draft: dropping it would leave the club's
   * stored override in place and the row would spring back on the next load.
   */
  const resetRow = (key: string) => {
    setOverrides((prev) => ({ ...prev, [key]: null }));
    setSaved(false);
  };

  const resetAll = () => {
    setOverrides(
      Object.fromEntries(Object.keys(rules?.settings ?? {}).map((key) => [key, null]))
    );
    setSaved(false);
  };

  const save = async () => {
    if (!rules) return;
    try {
      setSaving(true);
      setErrorKey(null);
      setErrorText(null);

      /*
       * The club's own settings after this edit: what it had overridden, plus
       * what it is changing now, minus anything reset. Locked keys are never
       * included — the API refuses them with a 403, and sending one would turn
       * an unrelated save into a failure.
       */
      const locked = new Set(rules.locked);
      const settings: Record<string, unknown> = {};
      for (const [key, source] of Object.entries(rules.sources)) {
        if (source === 'organisation' && !locked.has(key)) settings[key] = rules.settings[key];
      }
      for (const [key, value] of Object.entries(overrides)) {
        if (locked.has(key)) continue;
        if (value === null || value === '') delete settings[key];
        else settings[key] = value;
      }

      await execute({
        method: 'PUT',
        url: `/api/orgadmin/organisation/event-rules/${rules.templateId}`,
        data: { settings },
        throwOnError: true,
      });

      setSaved(true);
      await loadRules(rules.templateId);
    } catch (err: any) {
      setErrorKey('settings.eventRules.messages.saveFailed');
      // A refusal names the key it refused, and that sentence is the whole
      // value of the error.
      setErrorText(err?.message ?? null);
    } finally {
      setSaving(false);
    }
  };

  const lockedBy = organisation?.organizationType?.displayName
    ? t('settings.eventRules.lockedBy', { name: organisation.organizationType.displayName })
    : t('settings.eventRules.lockedByType');

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress aria-label={t('common.messages.loading')} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('settings.eventRules.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        {t('settings.eventRules.description')}
      </Typography>

      {(errorKey || errorText) && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => { setErrorKey(null); setErrorText(null); }}>
          {errorText || (errorKey ? t(errorKey) : null)}
        </Alert>
      )}

      {templates.length === 0 ? (
        <Alert severity="info">{t('settings.eventRules.noTemplates')}</Alert>
      ) : (
        <>
          <TextField
            select
            label={t('settings.eventRules.discipline')}
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            sx={{ minWidth: 280, mb: 3 }}
            /*
             * Shown even for a single discipline. It names what is being
             * edited, and a club that gains a second one should not find the
             * screen has changed shape.
             */
            helperText={t('settings.eventRules.disciplineHelp')}
          >
            {templates.map((candidate) => (
              <MenuItem key={candidate.id} value={candidate.id}>
                {candidate.displayName}
              </MenuItem>
            ))}
          </TextField>

          {loadingRules ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress aria-label={t('common.messages.loading')} />
            </Box>
          ) : groups.length === 0 ? (
            <Alert severity="info">{t('settings.eventRules.noSettings')}</Alert>
          ) : (
            <>
              <Table size="small" aria-label={t('settings.eventRules.title')}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('settings.eventRules.columns.setting')}</TableCell>
                    <TableCell width={200}>{t('settings.eventRules.columns.value')}</TableCell>
                    <TableCell width={200}>{t('settings.eventRules.columns.from')}</TableCell>
                    <TableCell width={60} align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groups.map((group) => (
                    <React.Fragment key={group.key ?? '__ungrouped'}>
                      {group.key && (
                        <TableRow>
                          <TableCell colSpan={4} sx={{ borderBottom: 'none', pt: 2 }}>
                            <Typography variant="subtitle2">{group.label}</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                      {group.rows.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell sx={{ pl: group.key ? 4 : 2 }}>{row.label}</TableCell>

                          <TableCell>
                            {row.locked ? (
                              /*
                               * No input at all. The value, then a sentence
                               * naming who fixed it.
                               */
                              <Typography variant="body2">{String(row.value ?? '')}</Typography>
                            ) : row.type === 'boolean' ? (
                              <Switch
                                checked={!!row.value}
                                onChange={(event) => setValue(row.key, event.target.checked)}
                                inputProps={{ 'aria-label': row.label }}
                              />
                            ) : (
                              <TextField
                                size="small"
                                fullWidth
                                type={row.type === 'number' ? 'number' : 'text'}
                                value={row.value === null || row.value === undefined ? '' : String(row.value)}
                                onChange={(event) =>
                                  setValue(
                                    row.key,
                                    row.type === 'number'
                                      ? event.target.value === ''
                                        ? ''
                                        : Number(event.target.value)
                                      : event.target.value
                                  )
                                }
                                inputProps={{ 'aria-label': row.label }}
                              />
                            )}
                          </TableCell>

                          <TableCell>
                            {row.locked ? (
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <LockIcon fontSize="inherit" color="action" />
                                <Typography variant="body2" color="text.secondary">
                                  {lockedBy}
                                </Typography>
                              </Stack>
                            ) : (
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="body2" color="text.secondary">
                                  {row.source ? t(FROM_KEYS[row.source]) : ''}
                                </Typography>
                                {changedHere(row.key) && (
                                  <Chip
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                    label={t('settings.eventRules.changedHere')}
                                  />
                                )}
                              </Stack>
                            )}
                          </TableCell>

                          <TableCell align="right">
                            {!row.locked && changedHere(row.key) && (
                              <Tooltip title={t('settings.eventRules.reset')}>
                                <span>
                                  <Button
                                    size="small"
                                    startIcon={<RestoreIcon fontSize="small" />}
                                    onClick={() => resetRow(row.key)}
                                    aria-label={`${t('settings.eventRules.reset')}: ${row.label}`}
                                  >
                                    {t('settings.eventRules.resetShort')}
                                  </Button>
                                </span>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                {t('settings.eventRules.inheritedNote')}
              </Typography>

              <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                <Button variant="contained" onClick={save} disabled={saving}>
                  {t('common.actions.save')}
                </Button>
                <Button onClick={resetAll} disabled={saving}>
                  {t('settings.eventRules.resetAll')}
                </Button>
              </Stack>
            </>
          )}
        </>
      )}

      <Snackbar
        open={saved}
        autoHideDuration={4000}
        onClose={() => setSaved(false)}
        message={t('settings.eventRules.messages.saved')}
      />
    </Box>
  );
};

export default EventRulesTab;
