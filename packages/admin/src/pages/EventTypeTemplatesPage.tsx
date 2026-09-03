import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getEventTypeTemplates } from '../services/eventTemplateApi';
import type { EventTypeTemplate } from '../types/eventTemplate.types';
import { SCHEDULER_KINDS } from '../types/eventTemplate.types';
import { useNotification } from '../context/NotificationContext';
import { AdminTable, AdminTableColumn } from '../components/AdminTable';
import { PageHeader } from '../components/PageHeader';

/**
 * Event type templates — the disciplines the platform defines.
 *
 * A club's own event types are free text with no behaviour. A discipline that
 * knows how to schedule itself is defined once here, and a club's event type
 * points at it, so this list is small, rarely changed, and consequential: every
 * club running eventing runs the row called eventing.
 */
export const EventTypeTemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<EventTypeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const navigate = useNavigate();
  const { showError } = useNotification();

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      setLoadFailed(false);
      setTemplates(await getEventTypeTemplates());
    } catch (error) {
      setLoadFailed(true);
      showError('Failed to load event type templates');
      console.error('Error loading event type templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns: AdminTableColumn<EventTypeTemplate>[] = useMemo(
    () => [
      {
        id: 'name',
        label: 'Name',
        width: 260,
        sortValue: (template) => template.displayName,
        render: (template) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap title={template.displayName}>
              {template.displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {template.key}
            </Typography>
          </Box>
        ),
      },
      {
        id: 'scheduler',
        label: 'Scheduler',
        width: 170,
        sortValue: (template) => template.schedulerKind,
        render: (template) =>
          SCHEDULER_KINDS.find((kind) => kind.value === template.schedulerKind)?.label ??
          template.schedulerKind,
      },
      {
        id: 'phases',
        label: 'Phases',
        align: 'right',
        width: 110,
        truncate: false,
        sortValue: (template) => template.shape?.phases?.length ?? 0,
        render: (template) => {
          const phases = template.shape?.phases ?? [];
          if (phases.length === 0) {
            return (
              <Typography variant="body2" color="text.secondary">
                None
              </Typography>
            );
          }
          return (
            <Tooltip title={phases.map((phase) => phase.name).join(', ')}>
              <Chip size="small" label={phases.length} variant="outlined" />
            </Tooltip>
          );
        },
      },
      {
        id: 'capability',
        label: 'Capability',
        width: 200,
        sortValue: (template) => template.capability ?? '',
        render: (template) =>
          template.capability ?? (
            /*
             * "Any club with scheduling", not an empty cell. A null capability
             * is a decision — no gate beyond the module — and a blank would
             * read as one nobody had got round to making.
             */
            <Typography variant="body2" color="text.secondary">
              Any club with scheduling
            </Typography>
          ),
      },
      {
        id: 'status',
        label: 'Status',
        width: 130,
        truncate: false,
        sortValue: (template) => template.status,
        render: (template) => (
          <Chip
            size="small"
            label={template.status === 'published' ? 'Published' : 'Draft'}
            color={template.status === 'published' ? 'success' : 'default'}
            variant={template.status === 'published' ? 'filled' : 'outlined'}
          />
        ),
      },
      {
        id: 'actions',
        label: 'Actions',
        align: 'right',
        width: 90,
        truncate: false,
        render: (template) => (
          <IconButton
            size="small"
            onClick={() => navigate(`/event-type-templates/${template.id}/edit`)}
            aria-label={`Edit ${template.displayName}`}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        ),
      },
    ],
    [navigate]
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
          Loading event type templates…
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Event type templates"
        description="A discipline the platform defines once: its phases, what it runs on, and the rules a club starts from. Clubs see a template only where their capabilities include it, and never while it is a draft."
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/event-type-templates/new')}
          >
            Create template
          </Button>
        }
      />

      {loadFailed && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={load}>
              Try again
            </Button>
          }
        >
          Event type templates could not be loaded.
        </Alert>
      )}

      <AdminTable
        rows={templates}
        columns={columns}
        getRowId={(template) => template.id}
        ariaLabel="Event type templates"
        searchFields={(template) => [template.displayName, template.key, template.capability]}
        searchPlaceholder="Search templates…"
        urlKey="templates"
        onRowOpen={(template) => navigate(`/event-type-templates/${template.id}/edit`)}
        onCreate={() => navigate('/event-type-templates/new')}
        createLabel="Create template"
        emptyState={
          <Typography variant="body2" color="text.secondary">
            No templates yet. A club cannot schedule an event until a template exists for its
            discipline.
          </Typography>
        }
      />
    </Box>
  );
};

export default EventTypeTemplatesPage;
