import { describe, it, expect, vi } from 'vitest';
import { renderWithI18n, screen } from '../../test/i18n-test-utils';
import FieldConfigurationTable from '../FieldConfigurationTable';

describe('FieldConfigurationTable', () => {
  it('renders empty state when no fields', () => {
    renderWithI18n(
      <FieldConfigurationTable
        fields={[]}
        fieldConfiguration={{}}
        onChange={vi.fn()}
      />
    );
    
    expect(screen.getByText(/select a membership form/i)).toBeInTheDocument();
  });

  it('renders field configuration table with fields', () => {
    const fields = [
      { id: '1', name: 'firstName', label: 'First Name', datatype: 'text', required: true },
      { id: '2', name: 'email', label: 'Email', datatype: 'email', required: true },
    ];
    
    renderWithI18n(
      <FieldConfigurationTable
        fields={fields}
        fieldConfiguration={{ '1': 'common', '2': 'unique' }}
        onChange={vi.fn()}
      />
    );
    
    expect(screen.getByText('First Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });
});
