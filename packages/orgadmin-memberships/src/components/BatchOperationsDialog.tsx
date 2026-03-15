/**
 * Batch Operations Dialog Component
 * 
 * Dialog for batch operations:
 * - Mark Processed/Unprocessed
 * - Add Labels
 * - Remove Labels
 * With confirmation and progress indicators
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
import { useTranslation } from 'react-i18next';
import { useApi } from '@aws-web-framework/orgadmin-core';
import type { BatchOperationType } from '../types/membership.types';

interface BatchOperationsDialogProps {
  open: boolean;
  operation: BatchOperationType;
  selectedMembers: string[];
  members?: any[]; // Add members array to get existing labels
  onClose: () => void;
  onComplete: () => void;
}

const BatchOperationsDialog: React.FC<BatchOperationsDialogProps> = ({
  open,
  onClose,
  operation,
  selectedMembers,
  members = [],
  onComplete,
}) => {
  const { t } = useTranslation();
  const { execute } = useApi();
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingLabels, setExistingLabels] = useState<string[]>([]);
  const [selectedLabelsToRemove, setSelectedLabelsToRemove] = useState<string[]>([]);

  // Collect existing labels from selected members for remove operation
  React.useEffect(() => {
    if (open && operation === 'remove_labels' && members.length > 0) {
      const selectedMemberObjects = members.filter(m => selectedMembers.includes(m.id));
      const allLabels = new Set<string>();
      
      selectedMemberObjects.forEach(member => {
        if (member.labels && Array.isArray(member.labels)) {
          member.labels.forEach((label: string) => allLabels.add(label));
        }
      });
      
      setExistingLabels(Array.from(allLabels).sort());
      setSelectedLabelsToRemove([]);
    }
  }, [open, operation, selectedMembers, members]);

  const handleToggleLabelForRemoval = (label: string) => {
    setSelectedLabelsToRemove(prev => 
      prev.includes(label) 
        ? prev.filter(l => l !== label)
        : [...prev, label]
    );
  };

  const handleAddLabel = () => {
    if (labelInput.trim() && !labels.includes(labelInput.trim())) {
      setLabels(prev => [...prev, labelInput.trim()]);
      setLabelInput('');
    }
  };

  const handleRemoveLabel = (label: string) => {
    setLabels(prev => prev.filter(l => l !== label));
  };

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    try {
      const labelsToSend = operation === 'remove_labels' ? selectedLabelsToRemove : labels;
      
      const response = await execute({
        method: 'POST',
        url: '/api/orgadmin/members/batch',
        data: {
          memberIds: selectedMembers,
          operation,
          labels: needsLabels ? labelsToSend : undefined,
        },
      });

      if (response && response.success) {
        onComplete();
        handleClose();
      } else {
        setError(t('memberships.batch.error', 'Batch operation failed'));
      }
    } catch (err) {
      console.error('Batch operation failed:', err);
      setError(t('memberships.batch.error', 'Batch operation failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setLabels([]);
    setLabelInput('');
    setError(null);
    setExistingLabels([]);
    setSelectedLabelsToRemove([]);
    onClose();
  };

  const getTitle = () => {
    switch (operation) {
      case 'mark_processed':
        return t('memberships.batch.markProcessed.title');
      case 'mark_unprocessed':
        return t('memberships.batch.markUnprocessed.title');
      case 'add_labels':
        return t('memberships.batch.addLabels.title');
      case 'remove_labels':
        return t('memberships.batch.removeLabels.title');
      default:
        return 'Batch Operation';
    }
  };

  const getDescription = () => {
    const count = selectedMembers.length;
    switch (operation) {
      case 'mark_processed':
        return t('memberships.batch.markProcessed.message', { count });
      case 'mark_unprocessed':
        return t('memberships.batch.markUnprocessed.message', { count });
      case 'add_labels':
        return t('memberships.batch.addLabels.message', { count });
      case 'remove_labels':
        return t('memberships.batch.removeLabels.message', { count });
      default:
        return '';
    }
  };

  const needsLabels = operation === 'add_labels' || operation === 'remove_labels';
  const canExecute = operation === 'remove_labels' 
    ? selectedLabelsToRemove.length > 0
    : (!needsLabels || labels.length > 0);

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

        {needsLabels && (
          <Box>
            {operation === 'remove_labels' ? (
              // Remove labels: Show existing labels with checkboxes
              <>
                <Typography variant="subtitle2" gutterBottom>
                  {t('memberships.batch.removeLabels.selectLabels', 'Select labels to remove')}
                </Typography>
                {existingLabels.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('memberships.batch.removeLabels.noLabels', 'No labels found on selected members')}
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    {existingLabels.map((label) => (
                      <Chip
                        key={label}
                        label={label}
                        onClick={() => handleToggleLabelForRemoval(label)}
                        color={selectedLabelsToRemove.includes(label) ? 'primary' : 'default'}
                        variant={selectedLabelsToRemove.includes(label) ? 'filled' : 'outlined'}
                      />
                    ))}
                  </Box>
                )}
              </>
            ) : (
              // Add labels: Show input field to add new labels
              <>
                <Typography variant="subtitle2" gutterBottom>
                  {t('memberships.batch.addLabels.labelsToAdd')}
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
                    placeholder={t('memberships.fields.addLabel')}
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddLabel();
                      }
                    }}
                    sx={{ flexGrow: 1 }}
                  />
                  <Button onClick={handleAddLabel}>{t('memberships.actions.add')}</Button>
                </Box>
              </>
            )}
          </Box>
        )}

        {loading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('memberships.batch.processing')}
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
        >
          {t('memberships.actions.execute')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BatchOperationsDialog;
