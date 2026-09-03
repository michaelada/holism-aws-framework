import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createEventTypeTemplate,
  eventTemplateErrorMessage,
  getEventTypeTemplate,
  updateEventTypeTemplate,
} from '../services/eventTemplateApi';
import type { EventTypeTemplate, TemplateShape } from '../types/eventTemplate.types';
import { useNotification } from '../context/NotificationContext';
import { PageHeader } from '../components/PageHeader';
import { TemplateShapeEditor } from '../components/TemplateShapeEditor';
import { TemplateSettingsEditor } from '../components/TemplateSettingsEditor';

/**
 * Creating and editing an event type template.
 *
 * One page for both, because the second is the first with an id: a create form
 * that diverges from the edit form is how the two come to disagree about what a
 * template is.
 *
 * ## Publishing is its own act
 *
 * Saving a draft and revealing it to every club are different decisions and get
 * different buttons. A template published with no phases hands a club a
 * scheduler with nothing to schedule, so the confirmation says what publishing
 * means and the button is refused while the shape is empty.
 *
 * ## The key
 *
 * Editable while the template is a draft, and never after. Once published, a
 * club's event type points at this template and a saved event was run under it,
 * so the key is what a schedule, a score sheet and a result all name. The
 * server enforces this — the field being read-only here is the courtesy, not
 * the constraint.
 */

const EMPTY_SHAPE: TemplateShape = {
  phases: [],
  phaseOrder: 'strict',
  clubMayReorder: false,
  resourceKinds: [],
  entity: { mode: 'none' },
  settingLabels: {},
};

export const EditEventTypeTemplatePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const creating = !id;
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const [loading, setLoading] = useState(!creating);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [key, setKey] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [capability, setCapability] = useState('');
  const [schedulerKind, setSchedulerKind] = useState('sequential-phases');
  const [shape, setShape] = useState<TemplateShape>(EMPTY_SHAPE);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState<'draft' | 'published'>('draft');

  useEffect(() => {
    if (creating) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const apply = (template: EventTypeTemplate) => {
    setKey(template.key);
    setDisplayName(template.displayName);
    setDescription(template.description ?? '');
    setCapability(template.capability ?? '');
    setSchedulerKind(template.schedulerKind);
    setShape({ ...EMPTY_SHAPE, ...(template.shape ?? {}) });
    setSettings(template.defaultSettings ?? {});
    setStatus(template.status === 'published' ? 'published' : 'draft');
  };

  const load = async () => {
    try {
      setLoading(true);
      setLoadFailed(false);
      apply(await getEventTypeTemplate(id!));
    } catch (err) {
      setLoadFailed(true);
      showError('Failed to load the template');
      console.error('Error loading event type template:', err);
    } finally {
      setLoading(false);
    }
  };

  const published = status === 'published';
  const hasPhases = (shape.phases ?? []).length > 0;

  const body = () => ({
    key: key.trim(),
    displayName: displayName.trim(),
    description: description.trim() || null,
    /*
     * An empty box means "no gate beyond scheduling", which is a null and not
     * an empty string — the API distinguishes them, and a "" capability would
     * match nothing and hide the template from every club.
     */
    capability: capability.trim() || null,
    schedulerKind,
    shape,
    defaultSettings: settings,
  });

  const save = async (nextStatus?: 'draft' | 'published') => {
    setError(null);
    setSaving(true);
    try {
      const payload = { ...body(), ...(nextStatus ? { status: nextStatus } : {}) };
      if (creating) {
        const created = await createEventTypeTemplate(payload);
        showSuccess('Template created');
        navigate(`/event-type-templates/${created.id}/edit`, { replace: true });
      } else {
        apply(await updateEventTypeTemplate(id!, payload));
        showSuccess(nextStatus === 'published' ? 'Template published' : 'Template saved');
      }
    } catch (err) {
      // The API's own words — which for a refused key name the reason.
      setError(eventTemplateErrorMessage(err, 'The template could not be saved'));
      console.error('Error saving event type template:', err);
    } finally {
      setSaving(false);
      setConfirmPublish(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
          Loading template…
        </Typography>
      </Box>
    );
  }

  if (loadFailed) {
    return (
      <Box>
        <PageHeader title="Event type template" onBack={() => navigate('/event-type-templates')} />
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={load}>
              Try again
            </Button>
          }
        >
          The template could not be loaded.
        </Alert>
      </Box>
    );
  }

  const saveDisabled = saving || !key.trim() || !displayName.trim();

  return (
    <Box>
      <PageHeader
        title={creating ? 'Create event type template' : displayName || 'Event type template'}
        description="A discipline the platform defines once. Clubs point their own event types at it."
        onBack={() => navigate('/event-type-templates')}
        backLabel="Event type templates"
        actions={
          <Stack direction="row" spacing={1}>
            {!creating && !published && (
              <Button
                variant="outlined"
                disabled={saving || !hasPhases}
                onClick={() => setConfirmPublish(true)}
              >
                Publish
              </Button>
            )}
            <Button variant="contained" disabled={saveDisabled} onClick={() => void save()}>
              {creating ? 'Create template' : 'Save template'}
            </Button>
          </Stack>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Identity
            </Typography>
            <Chip
              size="small"
              label={published ? 'Published' : 'Draft'}
              color={published ? 'success' : 'default'}
              variant={published ? 'filled' : 'outlined'}
            />
          </Stack>

          <Stack spacing={2}>
            <TextField
              label="Key"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              disabled={published}
              required
              fullWidth
              helperText={
                published
                  ? 'A published template’s key cannot be changed — events already reference it.'
                  : 'The stable name code refers to: equestrian.eventing. Fixed once published.'
              }
            />
            <TextField
              label="Display name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              multiline
              minRows={2}
              fullWidth
            />
            <TextField
              label="Capability"
              value={capability}
              onChange={(event) => setCapability(event.target.value)}
              fullWidth
              helperText="Clubs see this template only where their capabilities include it. Leave blank for any club with event scheduling."
            />
          </Stack>
        </Paper>

        <TemplateShapeEditor
          value={shape}
          onChange={setShape}
          schedulerKind={schedulerKind}
          onSchedulerKindChange={setSchedulerKind}
        />

        <TemplateSettingsEditor
          settings={settings}
          onSettingsChange={setSettings}
          labels={shape.settingLabels ?? {}}
          onLabelsChange={(settingLabels) => setShape({ ...shape, settingLabels })}
        />
      </Stack>

      <Dialog open={confirmPublish} onClose={() => setConfirmPublish(false)}>
        <DialogTitle>Publish this template?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Every club whose capabilities include it will be able to point an event type at this
            template. Its key can no longer be changed, because saved events will name it.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmPublish(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void save('published')} disabled={saving}>
            Publish
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EditEventTypeTemplatePage;
