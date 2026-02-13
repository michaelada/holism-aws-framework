import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { FieldRenderer } from '../FieldRenderer';
import type { FieldDefinition } from '../../../types';

describe('FieldRenderer with document_upload', () => {
  const mockFieldDefinition: FieldDefinition = {
    id: 'doc-field',
    shortName: 'document',
    displayName: 'Upload Document',
    datatype: 'document_upload',
    helpText: 'Upload your documents',
    mandatory: false,
    validationRules: {},
  };

  it('renders DocumentUploadRenderer for document_upload datatype', () => {
    const handleChange = vi.fn();

    render(
      <FieldRenderer
        fieldDefinition={mockFieldDefinition}
        value={null}
        onChange={handleChange}
      />
    );

    expect(screen.getByText('Upload Document')).toBeInTheDocument();
    expect(screen.getByText('Choose Files')).toBeInTheDocument();
  });

  it('passes value to DocumentUploadRenderer', () => {
    const handleChange = vi.fn();
    const files = [new File(['content'], 'test.pdf', { type: 'application/pdf' })];

    render(
      <FieldRenderer
        fieldDefinition={mockFieldDefinition}
        value={files}
        onChange={handleChange}
      />
    );

    expect(screen.getByText('test.pdf')).toBeInTheDocument();
  });

  it('passes error to DocumentUploadRenderer', () => {
    const handleChange = vi.fn();

    render(
      <FieldRenderer
        fieldDefinition={mockFieldDefinition}
        value={null}
        onChange={handleChange}
        error="File is required"
      />
    );

    expect(screen.getByText('File is required')).toBeInTheDocument();
  });

  it('passes disabled prop to DocumentUploadRenderer', () => {
    const handleChange = vi.fn();

    render(
      <FieldRenderer
        fieldDefinition={mockFieldDefinition}
        value={null}
        onChange={handleChange}
        disabled
      />
    );

    const button = screen.getByText('Choose Files');
    expect(button).toBeDisabled();
  });

  it('passes required prop to DocumentUploadRenderer', () => {
    const handleChange = vi.fn();

    render(
      <FieldRenderer
        fieldDefinition={mockFieldDefinition}
        value={null}
        onChange={handleChange}
        required
      />
    );

    const label = screen.getByText('Upload Document');
    expect(label.parentElement).toHaveTextContent('*');
  });
});
