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
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import type { FieldDefinition } from '../../../types';

/**
 * File Metadata Interface
 * Represents uploaded file metadata stored in submission_data
 */
interface FileMetadata {
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
}

export interface DocumentUploadRendererProps {
  fieldDefinition: FieldDefinition;
  value: File[] | string[] | FileMetadata[] | (File | string | FileMetadata)[] | null;
  onChange: (value: File[] | string[] | FileMetadata[] | (File | string | FileMetadata)[] | null) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  onBlur?: () => void;
}

/**
 * DocumentUploadRenderer component for file upload fields
 * Supports multiple file uploads with preview and removal
 * Supports both click-to-upload and drag-and-drop
 * Displays existing uploaded files (URLs) and new files (File objects)
 * For image fields, validates that only image files are selected
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
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Check if this is an image upload field
  const isImageField = fieldDefinition.datatypeProperties?.fileType === 'image' || 
                       fieldDefinition.datatypeProperties?.acceptImages === true;

  // Define accepted file types
  const acceptedTypes = isImageField ? 'image/*' : undefined;
  const acceptedExtensions = isImageField 
    ? ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']
    : [];

  // Normalize value to array
  const files: (File | string | FileMetadata)[] = Array.isArray(value) ? value : value ? [value] : [];

  // Validate if file is an image
  const isValidImageFile = (file: File): boolean => {
    if (!isImageField) return true; // No validation needed for non-image fields
    
    // Check MIME type
    if (file.type.startsWith('image/')) {
      return true;
    }
    
    // Check file extension as fallback
    const fileName = file.name.toLowerCase();
    return acceptedExtensions.some(ext => fileName.endsWith(ext));
  };

  // Filter and validate files
  const validateFiles = (filesToValidate: File[]): { valid: File[]; invalid: File[] } => {
    if (!isImageField) {
      return { valid: filesToValidate, invalid: [] };
    }

    const valid: File[] = [];
    const invalid: File[] = [];

    filesToValidate.forEach(file => {
      if (isValidImageFile(file)) {
        valid.push(file);
      } else {
        invalid.push(file);
      }
    });

    return { valid, invalid };
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles = Array.from(selectedFiles);
    const { valid, invalid } = validateFiles(newFiles);

    if (invalid.length > 0) {
      const invalidNames = invalid.map(f => f.name).join(', ');
      const errorMsg = `The following files are not valid images: ${invalidNames}. Please select image files only (JPG, PNG, GIF, etc.).`;
      setValidationError(errorMsg);
      
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // If ALL files are invalid, don't call onChange at all
      if (valid.length === 0) {
        return;
      }
    } else {
      setValidationError(null);
    }

    if (valid.length > 0) {
      const updatedFiles = [...files, ...valid];
      onChange(updatedFiles);
      onBlur?.();
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const droppedFiles = event.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const newFiles = Array.from(droppedFiles);
      const { valid, invalid } = validateFiles(newFiles);

      if (invalid.length > 0) {
        const invalidNames = invalid.map(f => f.name).join(', ');
        setValidationError(
          `The following files are not valid images: ${invalidNames}. Please select image files only (JPG, PNG, GIF, etc.).`
        );
        
        // If ALL files are invalid, don't call onChange at all
        if (valid.length === 0) {
          return;
        }
      } else {
        setValidationError(null);
      }

      if (valid.length > 0) {
        const updatedFiles = [...files, ...valid];
        onChange(updatedFiles);
        onBlur?.();
      }
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

  const getFileName = (file: File | string | FileMetadata): string => {
    // Handle FileMetadata objects
    if (typeof file === 'object' && 'fileId' in file) {
      return file.fileName;
    }
    // Handle URL strings
    if (typeof file === 'string') {
      // Extract filename from URL
      const parts = file.split('/');
      return parts[parts.length - 1] || file;
    }
    // Handle File objects
    return file.name;
  };

  const getFileSize = (file: File | string | FileMetadata): string => {
    // Handle FileMetadata objects
    if (typeof file === 'object' && 'fileId' in file) {
      const sizeInKB = file.fileSize / 1024;
      if (sizeInKB < 1024) {
        return `${sizeInKB.toFixed(1)} KB`;
      }
      return `${(sizeInKB / 1024).toFixed(1)} MB`;
    }
    // Handle URL strings (no size info)
    if (typeof file === 'string') {
      return '';
    }
    // Handle File objects
    const sizeInKB = file.size / 1024;
    if (sizeInKB < 1024) {
      return `${sizeInKB.toFixed(1)} KB`;
    }
    return `${(sizeInKB / 1024).toFixed(1)} MB`;
  };

  const isUrl = (file: File | string | FileMetadata): boolean => {
    // FileMetadata objects have URLs but are not strings
    if (typeof file === 'object' && 'fileId' in file) {
      return false; // Will be handled separately
    }
    return typeof file === 'string';
  };

  const isFileMetadata = (file: File | string | FileMetadata): file is FileMetadata => {
    return typeof file === 'object' && 'fileId' in file;
  };

  return (
    <Box>
      <Typography variant="body2" gutterBottom>
        {fieldDefinition.displayName}
        {required && <span style={{ color: 'error.main' }}> *</span>}
      </Typography>

      {fieldDefinition.description && (
        <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
          {fieldDefinition.description}
        </Typography>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {/* Drag and drop zone */}
      <Paper
        variant="outlined"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          p: 3,
          mb: 2,
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          backgroundColor: isDragging ? 'action.hover' : 'background.paper',
          borderColor: isDragging ? 'primary.main' : error ? 'error.main' : 'divider',
          borderWidth: isDragging ? 2 : 1,
          borderStyle: 'dashed',
          transition: 'all 0.2s ease',
          '&:hover': disabled ? {} : {
            backgroundColor: 'action.hover',
            borderColor: 'primary.main',
          },
        }}
        onClick={disabled ? undefined : handleButtonClick}
      >
        <UploadIcon
          sx={{
            fontSize: 48,
            color: isDragging ? 'primary.main' : 'action.active',
            mb: 1,
          }}
        />
        <Typography variant="body1" gutterBottom>
          {isDragging 
            ? `Drop ${isImageField ? 'images' : 'files'} here` 
            : `Drag and drop ${isImageField ? 'images' : 'files'} here`}
        </Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          or
        </Typography>
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            handleButtonClick();
          }}
        >
          Choose {isImageField ? 'Images' : 'Files'}
        </Button>
        {isImageField && (
          <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 1 }}>
            Accepted formats: JPG, PNG, GIF, BMP, WebP, SVG
          </Typography>
        )}
      </Paper>

      {files.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1 }}>
          <List dense>
            {files.map((file, index) => (
              <ListItem key={index}>
                <FileIcon sx={{ mr: 2, color: 'action.active' }} />
                <ListItemText
                  primary={getFileName(file)}
                  secondary={
                    isFileMetadata(file) ? (
                      // FileMetadata: show size and download link
                      <>
                        {getFileSize(file)}
                        {file.url && (
                          <>
                            {' • '}
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'inherit' }}
                            >
                              Download
                            </a>
                          </>
                        )}
                      </>
                    ) : isUrl(file) ? (
                      // URL string: show view link
                      <a
                        href={file}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'inherit' }}
                      >
                        View file
                      </a>
                    ) : (
                      // File object: show size
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

      {(error || validationError) && (
        <FormHelperText error sx={{ mt: 1 }}>
          {validationError || error}
        </FormHelperText>
      )}
    </Box>
  );
}
