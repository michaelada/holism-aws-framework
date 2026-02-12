/**
 * Event Entry Details Dialog
 * 
 * Displays full details of an event entry including form submission data
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  Chip,
  Grid,
} from '@mui/material';
import {
  Close as CloseIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import type { EventEntry } from '../types/event.types';

interface EventEntryDetailsDialogProps {
  entry: EventEntry;
  open: boolean;
  onClose: () => void;
}

interface FormSubmission {
  id: string;
  submissionData: Record<string, any>;
  files: Array<{
    id: string;
    fieldId: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    s3Key: string;
  }>;
}

// Mock API hook - will be replaced with actual implementation
const useApi = () => ({
  execute: async () => {
    return {
      id: '1',
      submissionData: {},
      files: [],
    };
  },
});

const EventEntryDetailsDialog: React.FC<EventEntryDetailsDialogProps> = ({
  entry,
  open,
  onClose,
}) => {
  const { execute } = useApi();
  const [submission, setSubmission] = useState<FormSubmission | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && entry.formSubmissionId) {
      loadSubmission(entry.formSubmissionId);
    }
  }, [open, entry.formSubmissionId]);

  const loadSubmission = async (_submissionId: string) => {
    try {
      setLoading(true);
      const response = await execute();
      setSubmission(response);
    } catch (error) {
      console.error('Failed to load submission:', error);
      setSubmission(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFile = (fileId: string) => {
    // This will trigger a download of the file
    window.open(`/api/orgadmin/files/${fileId}`, '_blank');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'pending':
        return 'warning';
      case 'refunded':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Entry Details</Typography>
          <Button onClick={onClose} startIcon={<CloseIcon />}>
            Close
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="textSecondary">
              First Name
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {entry.firstName}
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="textSecondary">
              Last Name
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {entry.lastName}
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="textSecondary">
              Email
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {entry.email}
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="textSecondary">
              Quantity
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {entry.quantity}
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="textSecondary">
              Payment Status
            </Typography>
            <Chip
              label={entry.paymentStatus}
              color={getPaymentStatusColor(entry.paymentStatus)}
              size="small"
            />
          </Grid>

          {entry.paymentMethod && (
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="textSecondary">
                Payment Method
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {entry.paymentMethod}
              </Typography>
            </Grid>
          )}

          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="textSecondary">
              Entry Date
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {new Date(entry.entryDate).toLocaleString('en-GB')}
            </Typography>
          </Grid>
        </Grid>

        {submission && (
          <>
            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Form Submission Data
            </Typography>

            {loading ? (
              <Typography>Loading submission data...</Typography>
            ) : (
              <Box sx={{ mt: 2 }}>
                {Object.entries(submission.submissionData).map(([key, value]) => (
                  <Box key={key} sx={{ mb: 2 }}>
                    <Typography variant="body2" color="textSecondary">
                      {key}
                    </Typography>
                    <Typography variant="body1">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}

            {submission.files && submission.files.length > 0 && (
              <>
                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" gutterBottom>
                  Uploaded Files
                </Typography>

                <Box sx={{ mt: 2 }}>
                  {submission.files.map((file) => (
                    <Box
                      key={file.id}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        p: 2,
                        mb: 1,
                        border: '1px solid #e0e0e0',
                        borderRadius: 1,
                      }}
                    >
                      <Box>
                        <Typography variant="body1" fontWeight="medium">
                          {file.fileName}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {file.fileType} • {formatFileSize(file.fileSize)}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={() => handleDownloadFile(file.id)}
                      >
                        Download
                      </Button>
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default EventEntryDetailsDialog;
