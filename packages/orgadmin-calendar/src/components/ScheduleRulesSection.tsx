/**
 * Schedule Rules Section Component
 * 
 * Manages automated opening/closing schedule rules.
 */

import React from 'react';
import { Box, Button, Typography, Card, CardContent } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

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
  rules,
  onChange,
}) => {
  const handleAddRule = () => {
    const newRule: ScheduleRule = {
      startDate: new Date(),
      action: 'open',
    };
    onChange([...rules, newRule]);
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
        <Card variant="outlined">
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              No schedule rules configured.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {rules.map((rule, index) => (
            <Card key={index} variant="outlined">
              <CardContent>
                <Typography variant="body2">Rule {index + 1}: {rule.action}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ScheduleRulesSection;
