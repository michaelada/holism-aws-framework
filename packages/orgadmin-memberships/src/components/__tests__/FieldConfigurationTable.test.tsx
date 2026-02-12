import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FieldConfigurationTable from '../FieldConfigurationTable';

describe('FieldConfigurationTable', () => {
  it('renders empty state when no fields', () => {
    render(
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
    
    render(
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
