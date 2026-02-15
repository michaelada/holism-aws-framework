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
import { useTranslation } from 'react-i18next';
import { useApi } from '../../hooks/useApi';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

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
  const { t } = useTranslation();
  
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

  const TEMPLATE_TYPES = [
    { value: 'welcome', label: t('settings.emailTemplates.templateTypes.welcome') },
    { value: 'event_confirmation', label: t('settings.emailTemplates.templateTypes.eventConfirmation') },
    { value: 'payment_receipt', label: t('settings.emailTemplates.templateTypes.paymentReceipt') },
    { value: 'membership_confirmation', label: t('settings.emailTemplates.templateTypes.membershipConfirmation') },
    { value: 'password_reset', label: t('settings.emailTemplates.templateTypes.passwordReset') },
  ];

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
      setError(err.message || t('settings.emailTemplates.messages.loadFailed'));
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
      setError(err.message || t('settings.emailTemplates.messages.saveFailed'));
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
        {t('settings.emailTemplates.title')}
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        {t('settings.emailTemplates.subtitle')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {t('settings.emailTemplates.messages.saveSuccess')}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            select
            label={t('settings.emailTemplates.fields.templateType')}
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
            label={t('settings.emailTemplates.fields.subject')}
            value={formData.subject}
            onChange={(e) => handleChange('subject', e.target.value)}
            placeholder={t('settings.emailTemplates.fields.subjectPlaceholder')}
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label={t('settings.emailTemplates.fields.body')}
            value={formData.body}
            onChange={(e) => handleChange('body', e.target.value)}
            multiline
            rows={12}
            placeholder={t('settings.emailTemplates.fields.bodyPlaceholder')}
          />
        </Grid>

        <Grid item xs={12}>
          <Card sx={{ bgcolor: 'grey.50' }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                {t('settings.emailTemplates.variables.title')}
              </Typography>
              <Typography variant="body2" component="div">
                {t('settings.emailTemplates.variables.description')}
                <ul style={{ marginTop: 8, marginBottom: 0 }}>
                  <li><code>{'{{organisation_name}}'}</code> - {t('settings.emailTemplates.variables.organisationName')}</li>
                  <li><code>{'{{user_name}}'}</code> - {t('settings.emailTemplates.variables.userName')}</li>
                  <li><code>{'{{user_email}}'}</code> - {t('settings.emailTemplates.variables.userEmail')}</li>
                  <li><code>{'{{event_name}}'}</code> - {t('settings.emailTemplates.variables.eventName')}</li>
                  <li><code>{'{{event_date}}'}</code> - {t('settings.emailTemplates.variables.eventDate')}</li>
                  <li><code>{'{{activity_name}}'}</code> - {t('settings.emailTemplates.variables.activityName')}</li>
                  <li><code>{'{{amount}}'}</code> - {t('settings.emailTemplates.variables.amount')}</li>
                  <li><code>{'{{reference}}'}</code> - {t('settings.emailTemplates.variables.reference')}</li>
                  <li><code>{'{{membership_type}}'}</code> - {t('settings.emailTemplates.variables.membershipType')}</li>
                  <li><code>{'{{expiry_date}}'}</code> - {t('settings.emailTemplates.variables.expiryDate')}</li>
                  <li><code>{'{{reset_link}}'}</code> - {t('settings.emailTemplates.variables.resetLink')}</li>
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
              {t('settings.emailTemplates.fields.resetToDefault')}
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? t('settings.actions.saving') : t('settings.actions.saveChanges')}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EmailTemplatesTab;
