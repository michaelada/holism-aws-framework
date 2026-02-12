/**
 * Image Gallery Upload Component
 * 
 * Handles multiple image uploads with drag-and-drop reordering and preview.
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardMedia,
  IconButton,
  Typography,
  Grid,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';

interface ImageGalleryUploadProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

const ImageGalleryUpload: React.FC<ImageGalleryUploadProps> = ({
  images,
  onChange,
  maxImages = 10,
}) => {
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      // TODO: Implement actual S3 upload
      // For now, create data URLs for preview
      const newImages: string[] = [];
      for (let i = 0; i < files.length && images.length + newImages.length < maxImages; i++) {
        const file = files[i];
        const dataUrl = await readFileAsDataURL(file);
        newImages.push(dataUrl);
      }
      onChange([...images, ...newImages]);
    } catch (error) {
      console.error('Failed to upload images:', error);
    } finally {
      setUploading(false);
    }
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const handleSetMainImage = (index: number) => {
    if (index === 0) return;
    const reordered = [...images];
    const [mainImage] = reordered.splice(index, 1);
    reordered.unshift(mainImage);
    onChange(reordered);
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Product Images
      </Typography>

      <Grid container spacing={2}>
        {images.map((image, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card sx={{ position: 'relative' }}>
              <CardMedia
                component="img"
                height="200"
                image={image}
                alt={`Product image ${index + 1}`}
                sx={{ objectFit: 'cover' }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  display: 'flex',
                  gap: 1,
                }}
              >
                <IconButton
                  size="small"
                  onClick={() => handleSetMainImage(index)}
                  sx={{ bgcolor: 'background.paper' }}
                  title={index === 0 ? 'Main image' : 'Set as main image'}
                >
                  {index === 0 ? <StarIcon color="primary" /> : <StarBorderIcon />}
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => handleRemoveImage(index)}
                  sx={{ bgcolor: 'background.paper' }}
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
              {index === 0 && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 8,
                    left: 8,
                    bgcolor: 'primary.main',
                    color: 'white',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                  }}
                >
                  Main Image
                </Box>
              )}
            </Card>
          </Grid>
        ))}

        {images.length < maxImages && (
          <Grid item xs={12} sm={6} md={4}>
            <Button
              component="label"
              variant="outlined"
              fullWidth
              sx={{
                height: 200,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
              disabled={uploading}
            >
              <UploadIcon fontSize="large" />
              <Typography>
                {uploading ? 'Uploading...' : 'Upload Images'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {images.length} / {maxImages} images
              </Typography>
              <input
                type="file"
                hidden
                accept="image/*"
                multiple
                onChange={handleFileSelect}
              />
            </Button>
          </Grid>
        )}
      </Grid>

      {images.length === 0 && (
        <Typography color="text.secondary" align="center" sx={{ mt: 2 }}>
          No images uploaded yet. Upload at least one product image.
        </Typography>
      )}
    </Box>
  );
};

export default ImageGalleryUpload;
