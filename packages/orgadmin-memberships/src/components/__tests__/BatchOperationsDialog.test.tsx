import { describe, it, expect, vi } from 'vitest';
import { renderWithI18n, screen } from '../../test/i18n-test-utils';
import BatchOperationsDialog from '../BatchOperationsDialog';

describe('BatchOperationsDialog', () => {
  it('renders mark processed dialog', () => {
    renderWithI18n(
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
    renderWithI18n(
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
