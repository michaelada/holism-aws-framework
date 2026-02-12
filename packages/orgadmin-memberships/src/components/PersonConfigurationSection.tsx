/**
 * Person Configuration Section Component
 * 
 * For each person slot (1 to Max Number):
 * - Optional title input
 * - Optional labels multi-select
 * Dynamic based on Max Number of People
 * Only shown for group membership types
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  TextField,
  Typography,
} from '@mui/material';

interface PersonConfigurationSectionProps {
  maxPeople: number;
  personTitles: string[];
  personLabels: string[][];
  onTitleChange: (index: number, title: string) => void;
  onLabelsChange: (index: number, labels: string[]) => void;
}

const PersonConfigurationSection: React.FC<PersonConfigurationSectionProps> = ({
  maxPeople,
  personTitles,
  personLabels,
  onTitleChange,
  onLabelsChange,
}) => {
  const [labelInputs, setLabelInputs] = React.useState<string[]>(
    Array(maxPeople).fill('')
  );

  const handleAddLabel = (personIndex: number) => {
    const labelInput = labelInputs[personIndex];
    if (labelInput.trim() && !personLabels[personIndex]?.includes(labelInput.trim())) {
      const newLabels = [...(personLabels[personIndex] || []), labelInput.trim()];
      onLabelsChange(personIndex, newLabels);
      
      const newInputs = [...labelInputs];
      newInputs[personIndex] = '';
      setLabelInputs(newInputs);
    }
  };

  const handleRemoveLabel = (personIndex: number, label: string) => {
    const newLabels = (personLabels[personIndex] || []).filter(l => l !== label);
    onLabelsChange(personIndex, newLabels);
  };

  const handleLabelInputChange = (personIndex: number, value: string) => {
    const newInputs = [...labelInputs];
    newInputs[personIndex] = value;
    setLabelInputs(newInputs);
  };

  if (maxPeople === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">
          Set the maximum number of people to configure person slots
        </Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={2}>
      {Array.from({ length: maxPeople }, (_, index) => (
        <Grid item xs={12} md={6} key={index}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Person {index + 1}
              </Typography>

              <TextField
                fullWidth
                size="small"
                label="Title (Optional)"
                placeholder={`e.g., "Father/Guardian One", "Child 1"`}
                value={personTitles[index] || ''}
                onChange={(e) => onTitleChange(index, e.target.value)}
                sx={{ mb: 2 }}
              />

              <Typography variant="body2" color="text.secondary" gutterBottom>
                Labels (Optional)
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap', minHeight: 32 }}>
                {(personLabels[index] || []).map((label) => (
                  <Chip
                    key={label}
                    label={label}
                    size="small"
                    onDelete={() => handleRemoveLabel(index, label)}
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  placeholder="Add label"
                  value={labelInputs[index] || ''}
                  onChange={(e) => handleLabelInputChange(index, e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLabel(index);
                    }
                  }}
                  sx={{ flexGrow: 1 }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default PersonConfigurationSection;
