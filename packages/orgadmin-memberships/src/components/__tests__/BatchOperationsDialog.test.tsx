import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BatchOperationsDialog from '../BatchOperationsDialog';

describe('BatchOperationsDialog', () => {
  it('renders mark processed dialog', () => {
    render(
      <BatchOperationsDialog
        open={true}
        operation="mark_processed"
        selectedMembers={['1', '2']}
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />
    );
    
    expect(screen.getByText('Mark as Processed')).toBeInTheDocument();
  });

  it('renders add labels dialog with label input', () => {
    render(
      <BatchOperationsDialog
        open={true}
        operation="add_labels"
        selectedMembers={['1', '2']}
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />
    );
    
    expect(screen.getByText('Add Labels')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add label')).toBeInTheDocument();
  });
});
