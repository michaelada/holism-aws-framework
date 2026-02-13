import React, { useRef, useState } from 'react';
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
  LinearProgress,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  InsertDriveFile as FileIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  url?: string;
  file?: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress?: number;
  error?: string;
}

export interface FileUploadProps {
  value: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  onUpload?: (file: File) => Promise<{ id: string; url: string }>;
  label?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  multiple?: boolean;
  accept?: string;
  maxSize?: number; // in bytes
  maxFiles?: number;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * FileUpload component for uploading files with drag-and-drop support
 * Supports file size validation and upload progress tracking
 */
export function FileUpload({
  value,
  onChange,
  onUpload,
  label,
  helperText,
  error,
  disabled = false,
  required = false,
  multiple = true,
  accept,
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles,
}: FileUploadProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const validateFile = (file: File): string | null => {
    if (maxSize && file.size > maxSize) {
      return `File size exceeds maximum of ${formatFileSize(maxSize)}`;
    }
    return null;
  };

  const handleFiles = async (files: FileList) => {
    const newFiles: UploadedFile[] = [];

    // Check max files limit
    if (maxFiles && value.length + files.length > maxFiles) {
      // Show error or handle limit
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validationError = validateFile(file);

      const uploadedFile: UploadedFile = {
        id: `temp-${Date.now()}-${i}`,
        name: file.name,
        size: file.size,
        file,
        status: validationError ? 'error' : 'pending',
        error: validationError || undefined,
      };

      newFiles.push(uploadedFile);
    }

    const updatedFiles = [...value, ...newFiles];
    onChange(updatedFiles);

    // Upload files if onUpload is provided
    if (onUpload) {
      for (const uploadedFile of newFiles) {
        if (uploadedFile.status === 'error') continue;

        // Update status to uploading
        const uploadingFiles = updatedFiles.map((f) =>
          f.id === uploadedFile.id ? { ...f, status: 'uploading' as const, progress: 0 } : f
        );
        onChange(uploadingFiles);

        try {
          const result = await onUpload(uploadedFile.file!);
          
          // Update with success
          const successFiles = uploadingFiles.map((f) =>
            f.id === uploadedFile.id
              ? { ...f, id: result.id, url: result.url, status: 'success' as const, progress: 100 }
              : f
          );
          onChange(successFiles);
        } catch (err) {
          // Update with error
          const errorFiles = uploadingFiles.map((f) =>
            f.id === uploadedFile.id
              ? {
                  ...f,
                  status: 'error' as const,
                  error: err instanceof Error ? err.message : 'Upload failed',
                }
              : f
          );
          onChange(errorFiles);
        }
      }
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (id: string) => {
    const updatedFiles = value.filter((f) => f.id !== id);
    onChange(updatedFiles);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'success':
        return <SuccessIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <FileIcon color="action" />;
    }
  };

  return (
    <Box>
      {label && (
        <Typography variant="body2" gutterBottom>
          {label}
          {required && <span style={{ color: 'error.main' }}> *</span>}
        </Typography>
      )}

      {helperText && (
        <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
          {helperText}
        </Typography>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      <Paper
        variant="outlined"
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        sx={{
          p: 3,
          textAlign: 'center',
          bgcolor: dragActive ? 'action.hover' : 'background.paper',
          border: dragActive ? 2 : 1,
          borderColor: dragActive ? 'primary.main' : 'divider',
          borderStyle: 'dashed',
          cursor: disabled ? 'default' : 'pointer',
        }}
        onClick={!disabled ? handleButtonClick : undefined}
      >
        <UploadIcon sx={{ fontSize: 48, color: 'action.active', mb: 1 }} />
        <Typography variant="body1" gutterBottom>
          {dragActive ? 'Drop files here' : 'Drag and drop files here'}
        </Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          or
        </Typography>
        <Button variant="outlined" disabled={disabled} onClick={handleButtonClick}>
          Choose Files
        </Button>
        <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 1 }}>
          Maximum file size: {formatFileSize(maxSize)}
          {maxFiles && ` • Maximum ${maxFiles} file${maxFiles !== 1 ? 's' : ''}`}
        </Typography>
      </Paper>

      {value.length > 0 && (
        <Paper variant="outlined" sx={{ mt: 2 }}>
          <List dense>
            {value.map((file) => (
              <ListItem key={file.id}>
                <Box sx={{ mr: 2 }}>{getStatusIcon(file.status)}</Box>
                <ListItemText
                  primary={file.name}
                  secondary={
                    <Box>
                      <Typography variant="caption" component="span">
                        {formatFileSize(file.size)}
                      </Typography>
                      {file.status === 'error' && file.error && (
                        <Typography variant="caption" color="error" component="div">
                          {file.error}
                        </Typography>
                      )}
                      {file.status === 'uploading' && file.progress !== undefined && (
                        <LinearProgress
                          variant="determinate"
                          value={file.progress}
                          sx={{ mt: 0.5 }}
                        />
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={() => handleRemoveFile(file.id)}
                    disabled={disabled || file.status === 'uploading'}
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
