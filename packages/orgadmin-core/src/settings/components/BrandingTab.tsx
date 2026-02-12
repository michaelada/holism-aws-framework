/**
 * Branding Tab
 * 
 * Component for managing organisation branding including logo upload,
 * colour picker for theme colours, and branding preview
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Grid,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Avatar,
} from '@mui/material';
import {
  Save as SaveIcon,
  Upload as UploadIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useApi } from '../../hooks/useApi';

interface BrandingSettings {
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
}

const DEFAULT_COLORS = {
  primaryColor: '#1976d2',
  secondaryColor: '#dc004e',
  accentColor: '#ff9800',
  backgroundColor: '#ffffff',
  textColor: '#000000',
};

const BrandingTab: React.FC = () => {
  const { execute } = useApi();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState<BrandingSettings>({
    logoUrl: '',
    ...DEFAULT_COLORS,
  });

  useEffect(() => {
    loadBrandingSettings();
  }, []);

  const loadBrandingSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/organisation/branding-settings',
      });
      
      if (response) {
        setFormData({
          logoUrl: response.logoUrl || '',
          primaryColor: response.primaryColor || DEFAULT_COLORS.primaryColor,
          secondaryColor: response.secondaryColor || DEFAULT_COLORS.secondaryColor,
          accentColor: response.accentColor || DEFAULT_COLORS.accentColor,
          backgroundColor: response.backgroundColor || DEFAULT_COLORS.backgroundColor,
          textColor: response.textColor || DEFAULT_COLORS.textColor,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load branding settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof BrandingSettings, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    setSuccess(false);
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('Image size must be less than 2MB');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'logo');

      const response = await execute({
        method: 'POST',
        url: '/api/orgadmin/files/upload',
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response?.url) {
        handleChange('logoUrl', response.url);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    handleChange('logoUrl', '');
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await execute({
        method: 'PUT',
        url: '/api/orgadmin/organisation/branding-settings',
        data: formData,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save branding settings');
    } finally {
      setSaving(false);
    }
  };

  const handleResetColors = () => {
    setFormData(prev => ({
      ...prev,
      ...DEFAULT_COLORS,
    }));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Branding
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Customize your organisation's visual identity
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Branding settings saved successfully
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom>
            Logo
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {formData.logoUrl ? (
              <Avatar
                src={formData.logoUrl}
                alt="Organisation Logo"
                sx={{ width: 100, height: 100 }}
                variant="rounded"
              />
            ) : (
              <Avatar
                sx={{ width: 100, height: 100, bgcolor: 'grey.300' }}
                variant="rounded"
              >
                <UploadIcon sx={{ fontSize: 40 }} />
              </Avatar>
            )}
            
            <Box>
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="logo-upload"
                type="file"
                onChange={handleLogoUpload}
                disabled={uploading}
              />
              <label htmlFor="logo-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<UploadIcon />}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : 'Upload Logo'}
                </Button>
              </label>
              {formData.logoUrl && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleRemoveLogo}
                  sx={{ ml: 1 }}
                >
                  Remove
                </Button>
              )}
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Recommended: PNG or SVG, max 2MB
              </Typography>
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
            Theme Colours
          </Typography>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <input
              type="color"
              value={formData.primaryColor}
              onChange={(e) => handleChange('primaryColor', e.target.value)}
              style={{ width: 60, height: 40, border: 'none', cursor: 'pointer' }}
            />
            <TextField
              fullWidth
              label="Primary Colour"
              value={formData.primaryColor}
              onChange={(e) => handleChange('primaryColor', e.target.value)}
              placeholder="#1976d2"
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <input
              type="color"
              value={formData.secondaryColor}
              onChange={(e) => handleChange('secondaryColor', e.target.value)}
              style={{ width: 60, height: 40, border: 'none', cursor: 'pointer' }}
            />
            <TextField
              fullWidth
              label="Secondary Colour"
              value={formData.secondaryColor}
              onChange={(e) => handleChange('secondaryColor', e.target.value)}
              placeholder="#dc004e"
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <input
              type="color"
              value={formData.accentColor}
              onChange={(e) => handleChange('accentColor', e.target.value)}
              style={{ width: 60, height: 40, border: 'none', cursor: 'pointer' }}
            />
            <TextField
              fullWidth
              label="Accent Colour"
              value={formData.accentColor}
              onChange={(e) => handleChange('accentColor', e.target.value)}
              placeholder="#ff9800"
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <input
              type="color"
              value={formData.backgroundColor}
              onChange={(e) => handleChange('backgroundColor', e.target.value)}
              style={{ width: 60, height: 40, border: 'none', cursor: 'pointer' }}
            />
            <TextField
              fullWidth
              label="Background Colour"
              value={formData.backgroundColor}
              onChange={(e) => handleChange('backgroundColor', e.target.value)}
              placeholder="#ffffff"
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <input
              type="color"
              value={formData.textColor}
              onChange={(e) => handleChange('textColor', e.target.value)}
              style={{ width: 60, height: 40, border: 'none', cursor: 'pointer' }}
            />
            <TextField
              fullWidth
              label="Text Colour"
              value={formData.textColor}
              onChange={(e) => handleChange('textColor', e.target.value)}
              placeholder="#000000"
            />
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Button
            variant="outlined"
            onClick={handleResetColors}
            size="small"
          >
            Reset to Default Colours
          </Button>
        </Grid>

        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
            Preview
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <Card
            sx={{
              backgroundColor: formData.backgroundColor,
              color: formData.textColor,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                {formData.logoUrl && (
                  <Avatar
                    src={formData.logoUrl}
                    alt="Logo Preview"
                    sx={{ width: 50, height: 50 }}
                    variant="rounded"
                  />
                )}
                <Typography variant="h6">Organisation Name</Typography>
              </Box>
              
              <Button
                variant="contained"
                sx={{
                  backgroundColor: formData.primaryColor,
                  color: '#fff',
                  mr: 1,
                  '&:hover': {
                    backgroundColor: formData.primaryColor,
                    opacity: 0.9,
                  },
                }}
              >
                Primary Button
              </Button>
              
              <Button
                variant="contained"
                sx={{
                  backgroundColor: formData.secondaryColor,
                  color: '#fff',
                  mr: 1,
                  '&:hover': {
                    backgroundColor: formData.secondaryColor,
                    opacity: 0.9,
                  },
                }}
              >
                Secondary Button
              </Button>
              
              <Button
                variant="contained"
                sx={{
                  backgroundColor: formData.accentColor,
                  color: '#fff',
                  '&:hover': {
                    backgroundColor: formData.accentColor,
                    opacity: 0.9,
                  },
                }}
              >
                Accent Button
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default BrandingTab;
