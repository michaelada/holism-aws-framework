/**
 * Batch Operations Dialog
 *
 * Dialog for performing batch operations on selected registrations:
 * - Mark Processed / Mark Unprocessed: confirmation then immediate API call
 * - Add Labels / Remove Labels: label selection UI (text input + chips) then API call
 *
 * Calls onComplete on success which clears selection in the parent.
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import { useApi } from '@aws-web-framework/orgadmin-core';
import type { BatchOperationType } from '../types/registration.types';

interface BatchOperationsDialogProps {
  open: boolean;
  onClose: () => void;
  operation: BatchOperationType;
  selectedIds: string[];
  onComplete: () => void;
}

const BatchOperationsDialog: React.FC<BatchOperationsDialogProps> = ({
  open,
  onClose,
  operation,
  selectedIds,
  onComplete,
}) => {
  const { t } = useTranslation();
  const { execute } = useApi();
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLabelOperation = operation === 'add_labels' || operation === 'remove_labels';

  const handleAddLabel = () => {
    const trimmed = labelInput.trim();
    if (trimmed && !labels.includes(trimmed)) {
      setLabels(prev => [...prev, trimmed]);
      setLabelInput('');
    }
  };

  const handleRemoveLabel = (label: string) => {
    setLabels(prev => prev.filter(l => l !== label));
  };

  const getEndpointUrl = (): string => {
    switch (operation) {
      case 'mark_processed':
        return '/api/orgadmin/registrations/batch/mark-processed';
      case 'mark_unprocessed':
        return '/api/orgadmin/registrations/batch/mark-unprocessed';
      case 'add_labels':
        return '/api/orgadmin/registrations/batch/add-labels';
      case 'remove_labels':
        return '/api/orgadmin/registrations/batch/remove-labels';
    }
  };

  const getTitle = (): string => {
    switch (operation) {
      case 'mark_processed':
        return t('registrations.batch.markProcessed.title');
      case 'mark_unprocessed':
        return t('registrations.batch.markUnprocessed.title');
      case 'add_labels':
        return t('registrations.batch.addLabels.title');
      case 'remove_labels':
        return t('registrations.batch.removeLabels.title');
      default:
        return t('registrations.batch.title');
    }
  };

  const getDescription = (): string => {
    const count = selectedIds.length;
    switch (operation) {
      case 'mark_processed':
        return t('registrations.batch.markProcessed.message', { count });
      case 'mark_unprocessed':
        return t('registrations.batch.markUnprocessed.message', { count });
      case 'add_labels':
        return t('registrations.batch.addLabels.message', { count });
      case 'remove_labels':
        return t('registrations.batch.removeLabels.message', { count });
      default:
        return '';
    }
  };

  const handleExecute = async () => {
    setLoading(true);
    setError(null);

    try {
      const data: Record<string, unknown> = {
        registrationIds: selectedIds,
      };

      if (isLabelOperation) {
        data.labels = labels;
      }

      await execute({
        method: 'POST',
        url: getEndpointUrl(),
        data,
      });

      onComplete();
      resetAndClose();
    } catch (err) {
      setError(t('registrations.batch.error'));
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setLabels([]);
    setLabelInput('');
    setError(null);
    onClose();
  };

  const handleClose = () => {
    if (!loading) {
      resetAndClose();
    }
  };

  const canExecute = !isLabelOperation || labels.length > 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{getTitle()}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {getDescription()}
        </DialogContentText>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {isLabelOperation && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {operation === 'add_labels'
                ? t('registrations.batch.addLabels.labelsToAdd')
                : t('registrations.batch.removeLabels.labelsToRemove')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', minHeight: 40 }}>
              {labels.map((label) => (
                <Chip
                  key={label}
                  label={label}
                  onDelete={() => handleRemoveLabel(label)}
                />
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                placeholder={t('registrations.batch.labelPlaceholder')}
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddLabel();
                  }
                }}
                sx={{ flexGrow: 1 }}
                data-testid="label-input"
              />
              <Button onClick={handleAddLabel} data-testid="add-label-button">
                {t('registrations.actions.add')}
              </Button>
            </Box>
          </Box>
        )}

        {loading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('registrations.batch.processing')}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          onClick={handleExecute}
          variant="contained"
          disabled={loading || !canExecute}
          data-testid="execute-button"
        >
          {t('registrations.actions.execute')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BatchOperationsDialog;
