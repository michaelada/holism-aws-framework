import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CollapsibleSection from '../CollapsibleSection';

describe('CollapsibleSection', () => {
  const defaultProps = {
    id: 'test-section',
    title: 'Test Section',
    expanded: true,
    onToggle: vi.fn(),
    children: <div data-testid="child-content">Child content</div>,
  };

  it('renders the title', () => {
    render(<CollapsibleSection {...defaultProps} />);
    expect(screen.getByText('Test Section')).toBeInTheDocument();
  });

  it('sets the id attribute on the root Card element', () => {
    const { container } = render(<CollapsibleSection {...defaultProps} />);
    expect(container.querySelector('#test-section')).toBeTruthy();
  });

  it('shows children when expanded', () => {
    render(<CollapsibleSection {...defaultProps} expanded={true} />);
    expect(screen.getByTestId('child-content')).toBeVisible();
  });

  it('hides children when collapsed', () => {
    render(<CollapsibleSection {...defaultProps} expanded={false} />);
    expect(screen.queryByTestId('child-content')).not.toBeVisible();
  });

  it('calls onToggle when header is clicked', () => {
    const onToggle = vi.fn();
    render(<CollapsibleSection {...defaultProps} onToggle={onToggle} />);
    fireEvent.click(screen.getByTestId('section-header-test-section'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onToggle on Enter key press', () => {
    const onToggle = vi.fn();
    render(<CollapsibleSection {...defaultProps} onToggle={onToggle} />);
    fireEvent.keyDown(screen.getByTestId('section-header-test-section'), { key: 'Enter' });
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onToggle on Space key press', () => {
    const onToggle = vi.fn();
    render(<CollapsibleSection {...defaultProps} onToggle={onToggle} />);
    fireEvent.keyDown(screen.getByTestId('section-header-test-section'), { key: ' ' });
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows ExpandLess icon when expanded', () => {
    render(<CollapsibleSection {...defaultProps} expanded={true} />);
    expect(screen.getByLabelText('Collapse section')).toBeInTheDocument();
  });

  it('shows ExpandMore icon when collapsed', () => {
    render(<CollapsibleSection {...defaultProps} expanded={false} />);
    expect(screen.getByLabelText('Expand section')).toBeInTheDocument();
  });

  it('sets aria-expanded on the header', () => {
    const { rerender } = render(<CollapsibleSection {...defaultProps} expanded={true} />);
    expect(screen.getByTestId('section-header-test-section')).toHaveAttribute('aria-expanded', 'true');

    rerender(<CollapsibleSection {...defaultProps} expanded={false} />);
    expect(screen.getByTestId('section-header-test-section')).toHaveAttribute('aria-expanded', 'false');
  });
});
