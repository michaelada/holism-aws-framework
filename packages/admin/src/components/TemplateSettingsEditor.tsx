import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { describeSettings } from '@itsplainsailing/components';
import type { SettingValueType } from '@itsplainsailing/components';

/**
 * A template's default settings — what a club starts from and may change.
 *
 * Rows, groups and input types all come from `describeSettings`, the same
 * function the org-admin's Event rules tab uses, so the panel a platform
 * administrator learns here is the panel a club secretary sees later.
 *
 * The only thing this screen has that the others do not is **adding and
 * removing a setting**, because the set of settings is the template's to
 * define. A club changes values; the platform decides what there is to change.
 */

export interface TemplateSettingsEditorProps {
  settings: Record<string, unknown>;
  onSettingsChange: (settings: Record<string, unknown>) => void;
  /** `key → wording`, stored in the template's shape. */
  labels: Record<string, string>;
  onLabelsChange: (labels: Record<string, string>) => void;
  disabled?: boolean;
}

/** Dotted, lower case: `minutesPerCompetitor.dressage`, `objectionsWindow`. */
const SETTING_KEY_PATTERN = /^[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*$/;

export const TemplateSettingsEditor: React.FC<TemplateSettingsEditorProps> = ({
  settings,
  onSettingsChange,
  labels,
  onLabelsChange,
  disabled = false,
}) => {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ key: '', label: '', type: 'number' as SettingValueType });

  const groups = useMemo(() => describeSettings({ settings, labels }), [settings, labels]);

  const setValue = (key: string, value: unknown) =>
    onSettingsChange({ ...settings, [key]: value });

  const setLabel = (key: string, label: string) => {
    const next = { ...labels };
    // An empty label is the absence of one, not the string "". Storing blanks
    // would make the template carry a map of nothings that overrides the
    // humanised key with an empty cell.
    if (label.trim()) next[key] = label;
    else delete next[key];
    onLabelsChange(next);
  };

  const removeSetting = (key: string) => {
    const nextSettings = { ...settings };
    delete nextSettings[key];
    onSettingsChange(nextSettings);
    setLabel(key, '');
  };

  const addSetting = () => {
    const key = draft.key.trim();
    if (!key || !SETTING_KEY_PATTERN.test(key) || key in settings) return;

    const initial = draft.type === 'number' ? 0 : draft.type === 'boolean' ? false : '';
    onSettingsChange({ ...settings, [key]: initial });
    if (draft.label.trim()) onLabelsChange({ ...labels, [key]: draft.label.trim() });

    setDraft({ key: '', label: '', type: 'number' });
    setAdding(false);
  };

  const keyIsValid = !draft.key.trim() || SETTING_KEY_PATTERN.test(draft.key.trim());
  const keyIsTaken = draft.key.trim() in settings;

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Settings
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          disabled={disabled}
          onClick={() => setAdding(true)}
        >
          Add setting
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        What a club starts from. An organisation type may change any of these for its clubs and lock
        the ones it wants fixed; a club may change the rest. Raising a default here reaches every
        club that has not overridden it.
      </Typography>

      {groups.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No settings yet.
        </Typography>
      ) : (
        <Table size="small" aria-label="Default settings">
          <TableHead>
            <TableRow>
              <TableCell width={260}>Setting</TableCell>
              <TableCell width={280}>Wording</TableCell>
              <TableCell width={180}>Default</TableCell>
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
                    <TableCell sx={{ pl: group.key ? 4 : 2 }}>
                      <Typography variant="body2">{row.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.key}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder={row.label}
                        value={labels[row.key] ?? ''}
                        disabled={disabled}
                        onChange={(event) => setLabel(row.key, event.target.value)}
                        inputProps={{ 'aria-label': `Wording for ${row.key}` }}
                      />
                    </TableCell>
                    <TableCell>
                      {row.type === 'boolean' ? (
                        <Switch
                          checked={!!row.value}
                          disabled={disabled}
                          onChange={(event) => setValue(row.key, event.target.checked)}
                          inputProps={{ 'aria-label': `Default for ${row.key}` }}
                        />
                      ) : (
                        <TextField
                          size="small"
                          fullWidth
                          type={row.type === 'number' ? 'number' : 'text'}
                          value={row.value === null || row.value === undefined ? '' : String(row.value)}
                          disabled={disabled}
                          onChange={(event) =>
                            setValue(
                              row.key,
                              row.type === 'number'
                                ? /*
                                   * An empty box is not zero. Blanking a number
                                   * while retyping it would otherwise write 0
                                   * as the default and quietly stick.
                                   */
                                  event.target.value === ''
                                  ? ''
                                  : Number(event.target.value)
                                : event.target.value
                            )
                          }
                          inputProps={{ 'aria-label': `Default for ${row.key}` }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        disabled={disabled}
                        onClick={() => removeSetting(row.key)}
                        aria-label={`Remove ${row.key}`}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={adding} onClose={() => setAdding(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add a setting</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Key"
              value={draft.key}
              onChange={(event) => setDraft({ ...draft, key: event.target.value })}
              error={!keyIsValid || keyIsTaken}
              helperText={
                keyIsTaken
                  ? 'This template already has that setting'
                  : !keyIsValid
                    ? 'Letters and numbers, separated by dots'
                    : 'A dot groups settings on screen: minutesPerCompetitor.dressage'
              }
              fullWidth
              autoFocus
            />
            <TextField
              label="Wording (optional)"
              value={draft.label}
              onChange={(event) => setDraft({ ...draft, label: event.target.value })}
              helperText="Left blank, the key is turned into a sentence: Minutes per competitor."
              fullWidth
            />
            <TextField
              select
              label="Type"
              value={draft.type}
              onChange={(event) =>
                setDraft({ ...draft, type: event.target.value as SettingValueType })
              }
              fullWidth
            >
              <MenuItem value="number">Number</MenuItem>
              <MenuItem value="boolean">Yes or no</MenuItem>
              <MenuItem value="text">Text</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdding(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={addSetting}
            disabled={!draft.key.trim() || !keyIsValid || keyIsTaken}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          A setting's type follows its default: a number here gives every club a number box.
        </Typography>
      </Box>
    </Paper>
  );
};

export default TemplateSettingsEditor;
