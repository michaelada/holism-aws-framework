/**
 * Lazy Markdown Component
 * 
 * Lazy loads the react-markdown library to reduce initial bundle size.
 * Shows a loading state while the library is being loaded.
 * 
 * Requirements: Performance
 */

import React, { Suspense, lazy } from 'react';
import { Box, CircularProgress } from '@mui/material';
import type { Components } from 'react-markdown';

// Lazy load react-markdown
const ReactMarkdown = lazy(() => import('react-markdown'));

interface LazyMarkdownProps {
  /** Markdown content to render */
  children: string;
  /** Custom component overrides for markdown elements */
  components?: Components;
}

/**
 * Loading fallback component
 * Shows a centered spinner while markdown library loads
 */
const MarkdownLoader: React.FC = () => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 100,
      py: 2,
    }}
    role="status"
    aria-label="Loading content"
  >
    <CircularProgress size={24} />
  </Box>
);

/**
 * LazyMarkdown Component
 * 
 * Wraps react-markdown with lazy loading and a loading state.
 * This reduces the initial bundle size by only loading the markdown
 * renderer when it's actually needed.
 */
export const LazyMarkdown: React.FC<LazyMarkdownProps> = ({ children, components }) => {
  return (
    <Suspense fallback={<MarkdownLoader />}>
      <ReactMarkdown components={components}>
        {children}
      </ReactMarkdown>
    </Suspense>
  );
};

export default LazyMarkdown;
