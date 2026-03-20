/**
 * Image Gallery Upload Component
 * 
 * Handles multiple image uploads to S3 with drag-and-drop reordering and preview.
 * Images are stored as S3 keys. Display URLs are provided by the parent via imageUrls.
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardMedia,
  CircularProgress,
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
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import { useApi } from '@aws-web-framework/orgadmin-core';

interface ImageGalleryUploadProps {
  /** S3 keys (or legacy base64/http URLs) */
  images: string[];
  /** Signed URLs for display, parallel to images array */
  imageUrls?: string[];
  onChange: (images: string[]) => void;
  organisationId: string;
  maxImages?: number;
}

const ImageGalleryUpload: React.FC<ImageGalleryUploadProps> = ({
  images,
  imageUrls = [],
  onChange,
  organisationId,
  maxImages = 10,
}) => {
  const [uploading, setUploading] = useState(false);
  // Local URL cache for newly uploaded images (not yet in imageUrls from backend)
  const [localUrls, setLocalUrls] = useState<Record<string, string>>({});
  const { t } = useTranslation();
  const { execute } = useApi();

  // Build a key->URL map from the initial imageUrls prop so reordering works
  const [urlMap, setUrlMap] = useState<Record<string, string>>({});

  // Sync imageUrls prop into the map whenever it changes
  React.useEffect(() => {
    if (imageUrls.length > 0 && images.length > 0) {
      const newMap: Record<string, string> = { ...urlMap };
      images.forEach((key, i) => {
        if (imageUrls[i] && !newMap[key]) {
          newMap[key] = imageUrls[i];
        }
      });
      setUrlMap(newMap);
    }
  }, [imageUrls]);

  const getDisplayUrl = (img: string): string => {
    // Use mapped signed URL (survives reordering)
    if (urlMap[img]) return urlMap[img];
    // Use local cache for newly uploaded images
    if (localUrls[img]) return localUrls[img];
    // Legacy base64 or http URLs display directly
    if (img.startsWith('data:') || img.startsWith('http')) return img;
    return '';
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newKeys: string[] = [];
      const newLocalUrls: Record<string, string> = {};

      for (let i = 0; i < files.length && images.length + newKeys.length < maxImages; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('organisationId', organisationId);

        const response = await execute({
          method: 'POST',
          url: '/api/orgadmin/merchandise-images/upload',
          data: formData,
          headers: { 'Content-Type': 'multipart/form-data' },
          retryCount: 1,
        });

        if (response?.s3Key) {
          newKeys.push(response.s3Key);
          // Create a local object URL for immediate preview
          newLocalUrls[response.s3Key] = URL.createObjectURL(file);
        }
      }

      if (newKeys.length > 0) {
        setLocalUrls(prev => ({ ...prev, ...newLocalUrls }));
        onChange([...images, ...newKeys]);
      }
    } catch (error) {
      console.error('Failed to upload images:', error);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    const removed = images[index];
    onChange(images.filter((_, i) => i !== index));

    // Delete from S3 in background (best effort, skip legacy base64/http)
    if (removed && !removed.startsWith('data:') && !removed.startsWith('http')) {
      execute({
        method: 'DELETE',
        url: `/api/orgadmin/merchandise-images?key=${encodeURIComponent(removed)}`,
        retryCount: 0,
      }).catch(() => {});
    }
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
        {t('merchandise.images.title')}
      </Typography>

      <Grid container spacing={2}>
        {images.map((image, index) => {
          const displayUrl = getDisplayUrl(image);
          return (
            <Grid item xs={12} sm={6} md={4} key={image + index}>
              <Card sx={{ position: 'relative' }}>
                {displayUrl ? (
                  <CardMedia
                    component="img"
                    height="200"
                    image={displayUrl}
                    alt={t('merchandise.images.productImage', { number: index + 1 })}
                    sx={{ objectFit: 'cover' }}
                  />
                ) : (
                  <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CircularProgress size={24} />
                  </Box>
                )}
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
                    title={index === 0 ? t('merchandise.images.mainImage') : t('merchandise.images.setAsMain')}
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
                    {t('merchandise.images.mainImage')}
                  </Box>
                )}
              </Card>
            </Grid>
          );
        })}

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
              {uploading ? (
                <CircularProgress size={32} />
              ) : (
                <UploadIcon fontSize="large" />
              )}
              <Typography>
                {uploading ? t('merchandise.images.uploading') : t('merchandise.images.uploadImages')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('merchandise.images.imageCount', { current: images.length, max: maxImages })}
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
          {t('merchandise.images.noImages')}
        </Typography>
      )}
    </Box>
  );
};

export default ImageGalleryUpload;
