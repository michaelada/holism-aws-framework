import React, { useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  FormHelperText,
  Paper,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import type { FieldDefinition } from '../../../types';

export interface DocumentUploadRendererProps {
  fieldDefinition: FieldDefinition;
  value: File[] | string[] | null;
  onChange: (value: File[] | string[] | null) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  onBlur?: () => void;
}

/**
 * DocumentUploadRenderer component for file upload fields
 * Supports multiple file uploads with preview and removal
 * Displays existing uploaded files (URLs) and new files (File objects)
 */
export function DocumentUploadRenderer({
  fieldDefinition,
  value,
  onChange,
  error,
  disabled = false,
  required = false,
  onBlur,
}: DocumentUploadRendererProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normalize value to array
  const files: (File | string)[] = Array.isArray(value) ? value : value ? [value] : [];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles = Array.from(selectedFiles);
    const updatedFiles = [...files, ...newFiles];
    onChange(updatedFiles);
    onBlur?.();

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    onChange(updatedFiles.length > 0 ? updatedFiles : null);
    onBlur?.();
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const getFileName = (file: File | string): string => {
    if (typeof file === 'string') {
      // Extract filename from URL
      const parts = file.split('/');
      return parts[parts.length - 1] || file;
    }
    return file.name;
  };

  const getFileSize = (file: File | string): string => {
    if (typeof file === 'string') {
      return '';
    }
    const sizeInKB = file.size / 1024;
    if (sizeInKB < 1024) {
      return `${sizeInKB.toFixed(1)} KB`;
    }
    return `${(sizeInKB / 1024).toFixed(1)} MB`;
  };

  const isUrl = (file: File | string): file is string => {
    return typeof file === 'string';
  };

  return (
    <Box>
      <Typography variant="body2" gutterBottom>
        {fieldDefinition.displayName}
        {required && <span style={{ color: 'error.main' }}> *</span>}
      </Typography>

      {fieldDefinition.helpText && (
        <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
          {fieldDefinition.helpText}
        </Typography>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      <Button
        variant="outlined"
        startIcon={<UploadIcon />}
        onClick={handleButtonClick}
        disabled={disabled}
        fullWidth
        sx={{ mb: 2 }}
      >
        Choose Files
      </Button>

      {files.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1 }}>
          <List dense>
            {files.map((file, index) => (
              <ListItem key={index}>
                <FileIcon sx={{ mr: 2, color: 'action.active' }} />
                <ListItemText
                  primary={getFileName(file)}
                  secondary={
                    isUrl(file) ? (
                      <a
                        href={file}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'inherit' }}
                      >
                        View file
                      </a>
                    ) : (
                      getFileSize(file)
                    )
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={() => handleRemoveFile(index)}
                    disabled={disabled}
                    size="small"
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {error && (
        <FormHelperText error sx={{ mt: 1 }}>
          {error}
        </FormHelperText>
      )}
    </Box>
  );
}
