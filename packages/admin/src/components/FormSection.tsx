import { ReactNode } from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';

export interface FormSectionProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

/**
 * One decision area of a form.
 *
 * The long forms in this app used to be a single `Card` holding a flat
 * `flexDirection="column"` stack with `gap={3}` and nothing else — no dividers,
 * no headings, no grouping. Identity, currency, language, numbering policy and
 * money all carried identical visual weight, so there was no way to tell where
 * one decision ended and the next began.
 *
 * Each section is a card with a real `<h2>`, which also gives screen-reader
 * users a document outline to navigate the form by.
 */
export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h3" component="h2" gutterBottom>
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: '75ch' }}>
            {description}
          </Typography>
        )}
        <Box display="flex" flexDirection="column" gap={2.5}>
          {children}
        </Box>
      </CardContent>
    </Card>
  );
}
