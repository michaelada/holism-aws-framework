import React, { useMemo } from 'react';
import { Box, SxProps, Theme } from '@mui/material';
import DOMPurify from 'dompurify';

export interface RichTextProps {
  /** HTML from a rich-text editor. Sanitised before it is rendered. */
  html?: string | null;
  sx?: SxProps<Theme>;
}

/**
 * Render HTML written in one of the org-admin rich-text editors.
 *
 * Terms and conditions, event descriptions and confirmation messages are all
 * stored as HTML (`<p>this is a test</p>`). Rendering them as text shows the
 * member the tags; rendering them raw hands whoever wrote them script execution
 * in every reader's browser.
 *
 * **Sanitised here rather than trusted from the database.** The content is
 * written by an organisation administrator — not a stranger — but "not a
 * stranger" is not the same as "cannot be compromised", and a club admin
 * account is a much softer target than the platform. The cost of sanitising is
 * a few microseconds on text nobody notices; the cost of not doing it is stored
 * XSS against every member who opens the page.
 *
 * The allow-list is deliberately narrow: what a rich-text editor produces, and
 * nothing that loads or runs anything. No `img` or `iframe`, so a club cannot
 * accidentally turn its terms into a tracking beacon on a page members are
 * legally agreeing to.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
  'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'a', 'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

const ALLOWED_ATTR = ['href', 'title', 'target', 'rel'];

export const RichText: React.FC<RichTextProps> = ({ html, sx }) => {
  const clean = useMemo(() => {
    if (!html) return '';
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      // Relative and mailto links are fine; javascript: and data: are not.
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    });
  }, [html]);

  if (!clean) return null;

  return (
    <Box
      sx={{
        // The editors emit bare tags with no styling, so the defaults would
        // collapse paragraphs and lose list indentation.
        '& p': { mt: 0, mb: 1 },
        '& p:last-child': { mb: 0 },
        '& ul, & ol': { pl: 3, mb: 1, mt: 0 },
        '& li': { mb: 0.25 },
        '& h1, & h2, & h3, & h4': { mt: 1.5, mb: 0.5 },
        '& a': { color: 'primary.main' },
        '& table': { borderCollapse: 'collapse', width: '100%' },
        '& th, & td': { border: '1px solid', borderColor: 'divider', p: 0.5 },
        ...sx,
      }}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
};

export default RichText;
