/**
 * Schedule Rules Section Component
 *
 * Manages automated opening/closing schedule rules.
 * Each rule renders in an expandable card with a summary line
 * and editable fields for action, dates, time of day, and reason.
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';

interface ScheduleRule {
  startDate: Date;
  endDate?: Date;
  action: 'open' | 'close';
  timeOfDay?: string;
  reason?: string;
}

interface ScheduleRulesSectionProps {
  rules: ScheduleRule[];
  onChange: (rules: ScheduleRule[]) => void;
}

const ScheduleRulesSection: React.FC<ScheduleRulesSectionProps> = ({
  rules = [],
  onChange,
}) => {
  const { t } = useTranslation();
  const [expandedIndex, setExpandedIndex] = useState<number | false>(false);

  const handleAccordionChange = (index: number) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedIndex(isExpanded ? index : false);
  };

  const handleAddRule = () => {
    const newRule: ScheduleRule = {
      startDate: new Date(),
      action: 'open',
    };
    onChange([...rules, newRule]);
    setExpandedIndex(rules.length);
  };

  const handleRemoveRule = (index: number) => {
    const updated = rules.filter((_, i) => i !== index);
    onChange(updated);
    if (expandedIndex === index) {
      setExpandedIndex(false);
    }
  };

  const handleRuleChange = (index: number, field: keyof ScheduleRule, value: any) => {
    const updated = rules.map((rule, i) =>
      i === index ? { ...rule, [field]: value } : rule
    );
    onChange(updated);
  };

  const formatDateForInput = (date: Date | undefined): string => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  const formatDateForDisplay = (date: Date | undefined): string => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString();
  };

  const getSummaryText = (rule: ScheduleRule): string => {
    const action = (rule.action || 'open').charAt(0).toUpperCase() + (rule.action || 'open').slice(1);
    const start = formatDateForDisplay(rule.startDate);
    const end = rule.endDate ? ` - ${formatDateForDisplay(rule.endDate)}` : '';
    const time = rule.timeOfDay ? ` at ${rule.timeOfDay}` : '';
    return `${action}: ${start}${end}${time}`;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1">Schedule Rules</Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAddRule}
        >
          Add Rule
        </Button>
      </Box>

      {rules.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No schedule rules configured.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {rules.map((rule, index) => (
            <Accordion
              key={index}
              expanded={expandedIndex === index}
              onChange={handleAccordionChange(index)}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                  <Typography variant="body2">{getSummaryText(rule)}</Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveRule(index);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {/* Action */}
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>{t('calendar.fields.scheduleRuleAction')}</InputLabel>
                      <Select
                        value={rule.action || 'open'}
                        label={t('calendar.fields.scheduleRuleAction')}
                        onChange={(e) => handleRuleChange(index, 'action', e.target.value)}
                      >
                        <MenuItem value="open">Open</MenuItem>
                        <MenuItem value="close">Close</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Start Date */}
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label={t('calendar.fields.scheduleRuleStartDate')}
                      type="date"
                      value={formatDateForInput(rule.startDate)}
                      onChange={(e) => handleRuleChange(index, 'startDate', new Date(e.target.value))}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>

                  {/* End Date */}
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label={t('calendar.fields.scheduleRuleEndDate')}
                      type="date"
                      value={formatDateForInput(rule.endDate)}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleRuleChange(index, 'endDate', val ? new Date(val) : undefined);
                      }}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>

                  {/* Time of Day */}
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label={t('calendar.fields.scheduleRuleTimeOfDay')}
                      type="time"
                      value={rule.timeOfDay || ''}
                      onChange={(e) => handleRuleChange(index, 'timeOfDay', e.target.value)}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>

                  {/* Reason */}
                  <Grid item xs={12}>
                    <TextField
                      label={t('calendar.fields.scheduleRuleReason')}
                      value={rule.reason || ''}
                      onChange={(e) => handleRuleChange(index, 'reason', e.target.value)}
                      fullWidth
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ScheduleRulesSection;
