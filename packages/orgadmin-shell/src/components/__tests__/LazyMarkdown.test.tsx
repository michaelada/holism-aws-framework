/**
 * LazyMarkdown Component Tests
 * 
 * Tests for the lazy-loaded markdown renderer component.
 * Validates loading state and markdown rendering.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { LazyMarkdown } from '../LazyMarkdown';

describe('LazyMarkdown', () => {
  it('should show loading state initially', () => {
    render(<LazyMarkdown>Test content</LazyMarkdown>);
    
    // Loading indicator should be present
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading content')).toBeInTheDocument();
  });

  it('should render markdown content after loading', async () => {
    const markdownContent = '# Test Heading\n\nThis is a **bold** paragraph.';
    
    render(<LazyMarkdown>{markdownContent}</LazyMarkdown>);
    
    // Wait for the markdown to load and render
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
    
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test Heading');
    expect(screen.getByText('bold')).toBeInTheDocument();
  });

  it('should render lists correctly', async () => {
    const markdownContent = '- Item 1\n- Item 2\n- Item 3';
    
    render(<LazyMarkdown>{markdownContent}</LazyMarkdown>);
    
    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  it('should render links with proper attributes', async () => {
    const markdownContent = '[Test Link](https://example.com)';
    
    render(<LazyMarkdown>{markdownContent}</LazyMarkdown>);
    
    await waitFor(() => {
      expect(screen.getByText('Test Link')).toBeInTheDocument();
    });
    
    const link = screen.getByText('Test Link').closest('a');
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('should accept custom component overrides', async () => {
    const markdownContent = '# Custom Heading';
    const customComponents = {
      h1: ({ node, ...props }: any) => <h1 data-testid="custom-h1" {...props} />,
    };
    
    render(<LazyMarkdown components={customComponents}>{markdownContent}</LazyMarkdown>);
    
    await waitFor(() => {
      expect(screen.getByTestId('custom-h1')).toBeInTheDocument();
    });
    
    expect(screen.getByTestId('custom-h1')).toHaveTextContent('Custom Heading');
  });

  it('should handle empty content', async () => {
    render(<LazyMarkdown>{''}</LazyMarkdown>);
    
    // Should not crash and loading should complete
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  it('should handle complex markdown with multiple elements', async () => {
    const markdownContent = `
# Main Heading

This is a paragraph with **bold** and *italic* text.

## Subheading

- List item 1
- List item 2

[Link](https://example.com)
    `;
    
    render(<LazyMarkdown>{markdownContent}</LazyMarkdown>);
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
    
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Main Heading');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Subheading');
    expect(screen.getByText('bold')).toBeInTheDocument();
    expect(screen.getByText('italic')).toBeInTheDocument();
    expect(screen.getByText('List item 1')).toBeInTheDocument();
    expect(screen.getByText('Link')).toBeInTheDocument();
  });
});
