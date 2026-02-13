import React, { useRef, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  IconButton,
  Grid,
  Card,
  CardMedia,
  CardActions,
  FormHelperText,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  CropOriginal as CropIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';

export interface UploadedImage {
  id: string;
  name: string;
  url: string;
  file?: File;
  isMain?: boolean;
}

export interface ImageUploadProps {
  value: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  onUpload?: (file: File) => Promise<{ id: string; url: string }>;
  label?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  multiple?: boolean;
  maxSize?: number; // in bytes
  maxImages?: number;
  allowCrop?: boolean;
  aspectRatio?: number;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * ImageUpload component for uploading images with preview and cropping
 * Supports drag-and-drop, image preview, and setting main image
 */
export function ImageUpload({
  value,
  onChange,
  onUpload,
  label,
  helperText,
  error,
  disabled = false,
  required = false,
  multiple = true,
  maxSize = 5 * 1024 * 1024, // 5MB default
  maxImages,
  allowCrop = false,
  aspectRatio,
}: ImageUploadProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith('image/')) {
      return 'File must be an image';
    }
    if (maxSize && file.size > maxSize) {
      return `Image size exceeds maximum of ${formatFileSize(maxSize)}`;
    }
    return null;
  };

  const handleFiles = async (files: FileList) => {
    // Check max images limit
    if (maxImages && value.length + files.length > maxImages) {
      return;
    }

    const newImages: UploadedImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validationError = validateFile(file);

      if (validationError) {
        continue;
      }

      // Create preview URL
      const previewUrl = URL.createObjectURL(file);

      const image: UploadedImage = {
        id: `temp-${Date.now()}-${i}`,
        name: file.name,
        url: previewUrl,
        file,
        isMain: value.length === 0 && i === 0, // First image is main by default
      };

      newImages.push(image);
    }

    const updatedImages = [...value, ...newImages];
    onChange(updatedImages);

    // Upload images if onUpload is provided
    if (onUpload) {
      for (const image of newImages) {
        try {
          const result = await onUpload(image.file!);
          
          // Update with uploaded URL
          const uploadedImages = updatedImages.map((img) =>
            img.id === image.id ? { ...img, id: result.id, url: result.url, file: undefined } : img
          );
          onChange(uploadedImages);
        } catch (err) {
          console.error('Upload failed:', err);
          // Remove failed upload
          const filteredImages = updatedImages.filter((img) => img.id !== image.id);
          onChange(filteredImages);
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

  const handleRemoveImage = (id: string) => {
    const imageToRemove = value.find((img) => img.id === id);
    const updatedImages = value.filter((img) => img.id !== id);

    // If removed image was main, set first remaining image as main
    if (imageToRemove?.isMain && updatedImages.length > 0) {
      updatedImages[0].isMain = true;
    }

    onChange(updatedImages);
  };

  const handleSetMainImage = (id: string) => {
    const updatedImages = value.map((img) => ({
      ...img,
      isMain: img.id === id,
    }));
    onChange(updatedImages);
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

  const handlePreviewClose = () => {
    setPreviewImage(null);
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
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {value.length === 0 ? (
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
            {dragActive ? 'Drop images here' : 'Drag and drop images here'}
          </Typography>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            or
          </Typography>
          <Button variant="outlined" disabled={disabled}>
            Choose Images
          </Button>
          <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 1 }}>
            Maximum file size: {formatFileSize(maxSize)}
            {maxImages && ` • Maximum ${maxImages} image${maxImages !== 1 ? 's' : ''}`}
          </Typography>
        </Paper>
      ) : (
        <Box>
          <Grid container spacing={2}>
            {value.map((image) => (
              <Grid item xs={12} sm={6} md={4} key={image.id}>
                <Card>
                  <CardMedia
                    component="img"
                    height="200"
                    image={image.url}
                    alt={image.name}
                    sx={{ objectFit: 'cover', cursor: 'pointer' }}
                    onClick={() => setPreviewImage(image.url)}
                  />
                  <CardActions sx={{ justifyContent: 'space-between', px: 1 }}>
                    <Box>
                      <IconButton
                        size="small"
                        onClick={() => handleSetMainImage(image.id)}
                        disabled={disabled}
                        color={image.isMain ? 'primary' : 'default'}
                      >
                        {image.isMain ? <StarIcon /> : <StarBorderIcon />}
                      </IconButton>
                      {allowCrop && (
                        <IconButton size="small" disabled={disabled}>
                          <CropIcon />
                        </IconButton>
                      )}
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveImage(image.id)}
                      disabled={disabled}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}

            {(!maxImages || value.length < maxImages) && (
              <Grid item xs={12} sm={6} md={4}>
                <Paper
                  variant="outlined"
                  sx={{
                    height: 200,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: disabled ? 'default' : 'pointer',
                    borderStyle: 'dashed',
                    '&:hover': disabled ? {} : { bgcolor: 'action.hover' },
                  }}
                  onClick={!disabled ? handleButtonClick : undefined}
                >
                  <UploadIcon sx={{ fontSize: 48, color: 'action.active', mb: 1 }} />
                  <Typography variant="body2" color="textSecondary">
                    Add More Images
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        </Box>
      )}

      {error && (
        <FormHelperText error sx={{ mt: 1 }}>
          {error}
        </FormHelperText>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onClose={handlePreviewClose} maxWidth="md" fullWidth>
        <DialogTitle>Image Preview</DialogTitle>
        <DialogContent>
          {previewImage && (
            <Box sx={{ textAlign: 'center' }}>
              <img
                src={previewImage}
                alt="Preview"
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePreviewClose}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
