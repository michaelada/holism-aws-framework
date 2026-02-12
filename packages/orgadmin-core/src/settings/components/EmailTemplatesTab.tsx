/**
 * Email Templates Tab
 * 
 * Component for managing email templates used for notifications
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
  MenuItem,
  Card,
  CardContent,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { useApi } from '../../hooks/useApi';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

const TEMPLATE_TYPES = [
  { value: 'welcome', label: 'Welcome Email' },
  { value: 'event_confirmation', label: 'Event Entry Confirmation' },
  { value: 'payment_receipt', label: 'Payment Receipt' },
  { value: 'membership_confirmation', label: 'Membership Confirmation' },
  { value: 'password_reset', label: 'Password Reset' },
];

const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  welcome: {
    subject: 'Welcome to {{organisation_name}}',
    body: 'Dear {{user_name}},\n\nWelcome to {{organisation_name}}!\n\nBest regards,\nThe Team',
  },
  event_confirmation: {
    subject: 'Event Entry Confirmation - {{event_name}}',
    body: 'Dear {{user_name}},\n\nYour entry for {{event_name}} has been confirmed.\n\nEvent Details:\n- Date: {{event_date}}\n- Activity: {{activity_name}}\n\nBest regards,\n{{organisation_name}}',
  },
  payment_receipt: {
    subject: 'Payment Receipt - {{organisation_name}}',
    body: 'Dear {{user_name}},\n\nThank you for your payment.\n\nAmount: {{amount}}\nReference: {{reference}}\n\nBest regards,\n{{organisation_name}}',
  },
  membership_confirmation: {
    subject: 'Membership Confirmation - {{organisation_name}}',
    body: 'Dear {{user_name}},\n\nYour membership has been confirmed.\n\nMembership Type: {{membership_type}}\nValid Until: {{expiry_date}}\n\nBest regards,\n{{organisation_name}}',
  },
  password_reset: {
    subject: 'Password Reset Request',
    body: 'Dear {{user_name}},\n\nYou have requested to reset your password.\n\nClick here to reset: {{reset_link}}\n\nBest regards,\n{{organisation_name}}',
  },
};

const EmailTemplatesTab: React.FC = () => {
  const { execute } = useApi();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [selectedTemplate, setSelectedTemplate] = useState('welcome');
  const [templates, setTemplates] = useState<Record<string, EmailTemplate>>({});
  
  const [formData, setFormData] = useState({
    subject: '',
    body: '',
  });

  useEffect(() => {
    loadEmailTemplates();
  }, []);

  useEffect(() => {
    // Load selected template data
    const template = templates[selectedTemplate];
    if (template) {
      setFormData({
        subject: template.subject,
        body: template.body,
      });
    } else {
      // Use default template
      const defaultTemplate = DEFAULT_TEMPLATES[selectedTemplate];
      setFormData({
        subject: defaultTemplate?.subject || '',
        body: defaultTemplate?.body || '',
      });
    }
  }, [selectedTemplate, templates]);

  const loadEmailTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/organisation/email-templates',
      });
      
      if (response && Array.isArray(response)) {
        const templatesMap: Record<string, EmailTemplate> = {};
        response.forEach((template: EmailTemplate) => {
          templatesMap[template.name] = template;
        });
        setTemplates(templatesMap);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load email templates');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: 'subject' | 'body', value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    setSuccess(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await execute({
        method: 'PUT',
        url: '/api/orgadmin/organisation/email-templates',
        data: {
          name: selectedTemplate,
          subject: formData.subject,
          body: formData.body,
        },
      });

      // Update local state
      setTemplates(prev => ({
        ...prev,
        [selectedTemplate]: {
          id: templates[selectedTemplate]?.id || '',
          name: selectedTemplate,
          subject: formData.subject,
          body: formData.body,
        },
      }));

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save email template');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const defaultTemplate = DEFAULT_TEMPLATES[selectedTemplate];
    if (defaultTemplate) {
      setFormData({
        subject: defaultTemplate.subject,
        body: defaultTemplate.body,
      });
    }
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
        Email Templates
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Customize email templates sent to users
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Email template saved successfully
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            select
            label="Template Type"
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
          >
            {TEMPLATE_TYPES.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Subject"
            value={formData.subject}
            onChange={(e) => handleChange('subject', e.target.value)}
            placeholder="Email subject line"
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Body"
            value={formData.body}
            onChange={(e) => handleChange('body', e.target.value)}
            multiline
            rows={12}
            placeholder="Email body content"
          />
        </Grid>

        <Grid item xs={12}>
          <Card sx={{ bgcolor: 'grey.50' }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Available Variables
              </Typography>
              <Typography variant="body2" component="div">
                You can use the following variables in your templates:
                <ul style={{ marginTop: 8, marginBottom: 0 }}>
                  <li><code>{'{{organisation_name}}'}</code> - Organisation name</li>
                  <li><code>{'{{user_name}}'}</code> - User's full name</li>
                  <li><code>{'{{user_email}}'}</code> - User's email address</li>
                  <li><code>{'{{event_name}}'}</code> - Event name (event emails)</li>
                  <li><code>{'{{event_date}}'}</code> - Event date (event emails)</li>
                  <li><code>{'{{activity_name}}'}</code> - Activity name (event emails)</li>
                  <li><code>{'{{amount}}'}</code> - Payment amount (payment emails)</li>
                  <li><code>{'{{reference}}'}</code> - Payment reference (payment emails)</li>
                  <li><code>{'{{membership_type}}'}</code> - Membership type (membership emails)</li>
                  <li><code>{'{{expiry_date}}'}</code> - Expiry date (membership emails)</li>
                  <li><code>{'{{reset_link}}'}</code> - Password reset link (password reset)</li>
                </ul>
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Button
              variant="outlined"
              onClick={handleReset}
            >
              Reset to Default
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Template'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EmailTemplatesTab;
