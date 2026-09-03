import React from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
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
import {
  Add as AddIcon,
  ArrowDownward as DownIcon,
  ArrowUpward as UpIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import type {
  TemplateEntity,
  TemplatePhase,
  TemplateResourceKind,
  TemplateShape,
} from '../types/eventTemplate.types';
import { SCHEDULER_KINDS } from '../types/eventTemplate.types';

/**
 * The shape of a discipline — the part a club cannot override.
 *
 * ## Reordering is arrows, not drag
 *
 * The wireframe drew drag handles. This app already took the opposite decision
 * once, on `PostsPage`, and for reasons that apply more strongly here: arrows
 * are keyboard-reachable and screen-reader-legible without any of the machinery
 * drag needs, and a discipline has three or four phases, so a drag would rarely
 * be the faster thing. Two screens in one app that reorder differently is a
 * worse outcome than either choice.
 *
 * ## Why the panel argues with the reader
 *
 * The one sentence that prevents a support conversation is *"a club needing
 * different phases needs a new template"*, and the place it has to be said is
 * here, in front of the person who would otherwise be asked to make phases
 * editable. It is on the screen, not in a document nobody opens.
 */

export interface TemplateShapeEditorProps {
  value: TemplateShape;
  onChange: (shape: TemplateShape) => void;
  schedulerKind: string;
  onSchedulerKindChange: (kind: string) => void;
  disabled?: boolean;
}

/** A key a person types once and code depends on for ever. */
const KEY_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

const blankPhase = (): TemplatePhase => ({ key: '', name: '', resourceKind: '' });
const blankKind = (): TemplateResourceKind => ({ key: '', defaultLabel: '' });

export const TemplateShapeEditor: React.FC<TemplateShapeEditorProps> = ({
  value,
  onChange,
  schedulerKind,
  onSchedulerKindChange,
  disabled = false,
}) => {
  const phases = value.phases ?? [];
  const resourceKinds = value.resourceKinds ?? [];
  const entity: TemplateEntity = value.entity ?? { mode: 'none' };

  const patch = (part: Partial<TemplateShape>) => onChange({ ...value, ...part });

  const setPhase = (index: number, part: Partial<TemplatePhase>) =>
    patch({ phases: phases.map((phase, i) => (i === index ? { ...phase, ...part } : phase)) });

  const movePhase = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= phases.length) return;
    const next = [...phases];
    [next[index], next[target]] = [next[target], next[index]];
    patch({ phases: next });
  };

  const setKind = (index: number, part: Partial<TemplateResourceKind>) =>
    patch({
      resourceKinds: resourceKinds.map((kind, i) => (i === index ? { ...kind, ...part } : kind)),
    });

  /** Which phases would be left pointing at nothing if this kind went. */
  const phasesUsing = (kindKey: string) =>
    phases.filter((phase) => phase.resourceKind === kindKey).map((phase) => phase.name || phase.key);

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Shape
        </Typography>
      </Stack>

      <Alert severity="info" sx={{ mb: 3 }}>
        Not overridable by a club. A club needing different phases needs a new template.
      </Alert>

      <FormControl fullWidth sx={{ mb: 1 }} disabled={disabled}>
        <InputLabel id="scheduler-kind-label">Scheduler</InputLabel>
        <Select
          labelId="scheduler-kind-label"
          label="Scheduler"
          value={schedulerKind}
          onChange={(event) => onSchedulerKindChange(event.target.value)}
        >
          {SCHEDULER_KINDS.map((kind) => (
            <MenuItem key={kind.value} value={kind.value} disabled={!kind.available}>
              {kind.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Typography variant="caption" color="text.secondary">
        {SCHEDULER_KINDS.find((kind) => kind.value === schedulerKind)?.help ?? ''}
      </Typography>

      <Divider sx={{ my: 3 }} />

      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
          Phases
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          disabled={disabled}
          onClick={() => patch({ phases: [...phases, blankPhase()] })}
        >
          Add phase
        </Button>
      </Stack>

      {phases.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No phases yet. A template with no phases gives a club a scheduler with nothing to schedule,
          which is why publishing is a deliberate act.
        </Typography>
      ) : (
        <Table size="small" aria-label="Phases">
          <TableHead>
            <TableRow>
              <TableCell width={96}>Order</TableCell>
              <TableCell width={180}>Key</TableCell>
              <TableCell>Name</TableCell>
              <TableCell width={200}>Runs on</TableCell>
              <TableCell width={60} align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {phases.map((phase, index) => (
              <TableRow key={index}>
                <TableCell>
                  <IconButton
                    size="small"
                    disabled={disabled || index === 0}
                    onClick={() => movePhase(index, -1)}
                    aria-label={`Move ${phase.name || phase.key || 'phase'} earlier`}
                  >
                    <UpIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    disabled={disabled || index === phases.length - 1}
                    onClick={() => movePhase(index, 1)}
                    aria-label={`Move ${phase.name || phase.key || 'phase'} later`}
                  >
                    <DownIcon fontSize="small" />
                  </IconButton>
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    value={phase.key}
                    disabled={disabled}
                    onChange={(event) => setPhase(index, { key: event.target.value })}
                    inputProps={{ 'aria-label': `Key for phase ${index + 1}` }}
                    error={!!phase.key && !KEY_PATTERN.test(phase.key)}
                    helperText={
                      phase.key && !KEY_PATTERN.test(phase.key) ? 'Lower case, no spaces' : ' '
                    }
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    value={phase.name}
                    disabled={disabled}
                    onChange={(event) => setPhase(index, { name: event.target.value })}
                    inputProps={{ 'aria-label': `Name for phase ${index + 1}` }}
                    helperText=" "
                  />
                </TableCell>
                <TableCell>
                  <FormControl size="small" fullWidth disabled={disabled}>
                    <Select
                      value={phase.resourceKind}
                      displayEmpty
                      onChange={(event) => setPhase(index, { resourceKind: event.target.value })}
                      inputProps={{ 'aria-label': `Runs on, for phase ${index + 1}` }}
                    >
                      <MenuItem value="">
                        <em>Not set</em>
                      </MenuItem>
                      {resourceKinds.map((kind) => (
                        <MenuItem key={kind.key} value={kind.key}>
                          {kind.defaultLabel || kind.key}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    disabled={disabled}
                    onClick={() => patch({ phases: phases.filter((_, i) => i !== index) })}
                    aria-label={`Remove ${phase.name || phase.key || `phase ${index + 1}`}`}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Box sx={{ mt: 3 }}>
        <FormControl disabled={disabled}>
          <FormLabel id="phase-order-label">Phase order</FormLabel>
          <RadioGroup
            aria-labelledby="phase-order-label"
            value={value.phaseOrder ?? 'strict'}
            onChange={(event) =>
              patch({ phaseOrder: event.target.value as TemplateShape['phaseOrder'] })
            }
          >
            <FormControlLabel
              value="strict"
              control={<Radio />}
              label="Strict — in the order above"
            />
            <FormControlLabel value="any" control={<Radio />} label="Any order" />
          </RadioGroup>
        </FormControl>

        <FormControlLabel
          sx={{ display: 'block', mt: 1 }}
          control={
            <Switch
              checked={value.clubMayReorder ?? false}
              disabled={disabled}
              onChange={(event) => patch({ clubMayReorder: event.target.checked })}
            />
          }
          label="A club may reorder these for one event"
        />
        <Typography variant="caption" color="text.secondary">
          Dressage, then cross country, then show jumping — or dressage, show jumping, cross country.
          Both are eventing. Whether that is a legitimate variation of this discipline is the
          platform's decision; the club then exercises it per event.
        </Typography>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
          Resource kinds
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          disabled={disabled}
          onClick={() => patch({ resourceKinds: [...resourceKinds, blankKind()] })}
        >
          Add kind
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        What a phase runs on, and what a club calls it by default — arena, ring, court, lane, pool. A
        club may rename its own; it may not invent a kind.
      </Typography>

      {resourceKinds.map((kind, index) => {
        const used = phasesUsing(kind.key);
        return (
          <Stack direction="row" spacing={2} alignItems="flex-start" key={index} sx={{ mb: 1 }}>
            <TextField
              size="small"
              label="Key"
              value={kind.key}
              disabled={disabled}
              onChange={(event) => setKind(index, { key: event.target.value })}
              error={!!kind.key && !KEY_PATTERN.test(kind.key)}
              helperText={kind.key && !KEY_PATTERN.test(kind.key) ? 'Lower case, no spaces' : ' '}
              /*
               * Named for a screen reader, because three fields on this page
               * are visibly labelled "Key" — the template's, each phase's and
               * each resource kind's — and hearing "Key, edit text" three times
               * says nothing about which is which. The visible label stays
               * short, where the surrounding heading supplies the context a
               * sighted reader already has.
               */
              inputProps={{ 'aria-label': `Key for resource kind ${index + 1}` }}
              sx={{ width: 200 }}
            />
            <TextField
              size="small"
              label="Default label"
              value={kind.defaultLabel}
              disabled={disabled}
              onChange={(event) => setKind(index, { defaultLabel: event.target.value })}
              helperText={used.length > 0 ? `Used by ${used.join(', ')}` : ' '}
              inputProps={{ 'aria-label': `Default label for resource kind ${index + 1}` }}
              sx={{ flexGrow: 1 }}
            />
            <Tooltip
              title={
                used.length > 0
                  ? `Remove it from ${used.join(', ')} first`
                  : 'Remove this resource kind'
              }
            >
              <span>
                <IconButton
                  size="small"
                  /*
                   * Refused while a phase points at it, rather than removed
                   * leaving the phase pointing at a kind that is gone. The
                   * tooltip says which phases, so the refusal is actionable.
                   */
                  disabled={disabled || used.length > 0}
                  onClick={() =>
                    patch({ resourceKinds: resourceKinds.filter((_, i) => i !== index) })
                  }
                  aria-label={`Remove ${kind.defaultLabel || kind.key || `resource kind ${index + 1}`}`}
                  sx={{ mt: 0.5 }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        );
      })}

      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Entity
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        What a competitor brings — a horse, a boat, a dog. A rider with two horses enters twice and
        must not be scheduled against themselves, which is the whole reason this is modelled at all.
      </Typography>

      <Stack spacing={2}>
        <FormControl fullWidth disabled={disabled}>
          <InputLabel id="entity-mode-label">Resolved from</InputLabel>
          <Select
            labelId="entity-mode-label"
            label="Resolved from"
            value={entity.mode}
            onChange={(event) =>
              patch({ entity: { ...entity, mode: event.target.value as TemplateEntity['mode'] } })
            }
          >
            <MenuItem value="none">Nothing — competitors enter as themselves</MenuItem>
            <MenuItem value="field">A field on the entry form</MenuItem>
            <MenuItem value="registration-then-field">
              Registration, falling back to a form field
            </MenuItem>
          </Select>
        </FormControl>

        {entity.mode !== 'none' && (
          <>
            <TextField
              label="Label"
              value={entity.label ?? ''}
              disabled={disabled}
              onChange={(event) => patch({ entity: { ...entity, label: event.target.value } })}
              helperText="What a club calls it on screen — Horse, Boat, Dog."
              fullWidth
            />
            {entity.mode === 'registration-then-field' && (
              <TextField
                label="Registration type"
                value={entity.registrationType ?? ''}
                disabled={disabled}
                onChange={(event) =>
                  patch({ entity: { ...entity, registrationType: event.target.value } })
                }
                helperText="Preferred where the club uses registrations, so the entity is a first-class record."
                fullWidth
              />
            )}
            <TextField
              label="Form field when there is no registration"
              value={entity.formFieldKey ?? ''}
              disabled={disabled}
              onChange={(event) =>
                patch({ entity: { ...entity, formFieldKey: event.target.value } })
              }
              helperText="The field on the entry form that names it. Used where the club does not use registrations."
              fullWidth
            />
          </>
        )}
      </Stack>
    </Paper>
  );
};

export default TemplateShapeEditor;
