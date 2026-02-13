import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { DocumentUploadRenderer } from '../renderers/DocumentUploadRenderer';
import type { FieldDefinition } from '../../../types';

describe('DocumentUploadRenderer', () => {
  const mockFieldDefinition: FieldDefinition = {
    id: 'doc-field',
    shortName: 'document',
    displayName: 'Upload Document',
    datatype: 'document_upload',
    helpText: 'Upload your documents here',
    mandatory: false,
    validationRules: {},
  };

  it('renders upload button', () => {
    const handleChange = vi.fn();

    render(
      <DocumentUploadRenderer
        fieldDefinition={mockFieldDefinition}
        value={null}
        onChange={handleChange}
      />
    );

    expect(screen.getByText('Upload Document')).toBeInTheDocument();
    expect(screen.getByText('Choose Files')).toBeInTheDocument();
  });

  it('displays help text', () => {
    const handleChange = vi.fn();

    render(
      <DocumentUploadRenderer
        fieldDefinition={mockFieldDefinition}
        value={null}
        onChange={handleChange}
      />
    );

    expect(screen.getByText('Upload your documents here')).toBeInTheDocument();
  });

  it('handles file selection', async () => {
    const handleChange = vi.fn();
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    render(
      <DocumentUploadRenderer
        fieldDefinition={mockFieldDefinition}
        value={null}
        onChange={handleChange}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith([file]);
    });
  });

  it('displays uploaded files', () => {
    const handleChange = vi.fn();
    const files = [
      new File(['content1'], 'document1.pdf', { type: 'application/pdf' }),
      new File(['content2'], 'document2.pdf', { type: 'application/pdf' }),
    ];

    render(
      <DocumentUploadRenderer
        fieldDefinition={mockFieldDefinition}
        value={files}
        onChange={handleChange}
      />
    );

    expect(screen.getByText('document1.pdf')).toBeInTheDocument();
    expect(screen.getByText('document2.pdf')).toBeInTheDocument();
  });

  it('displays existing file URLs', () => {
    const handleChange = vi.fn();
    const fileUrls = ['https://example.com/file1.pdf', 'https://example.com/file2.pdf'];

    render(
      <DocumentUploadRenderer
        fieldDefinition={mockFieldDefinition}
        value={fileUrls}
        onChange={handleChange}
      />
    );

    expect(screen.getByText('file1.pdf')).toBeInTheDocument();
    expect(screen.getByText('file2.pdf')).toBeInTheDocument();
    expect(screen.getAllByText('View file')).toHaveLength(2);
  });

  it('removes file when delete button clicked', async () => {
    const handleChange = vi.fn();
    const files = [new File(['content'], 'test.pdf', { type: 'application/pdf' })];

    render(
      <DocumentUploadRenderer
        fieldDefinition={mockFieldDefinition}
        value={files}
        onChange={handleChange}
      />
    );

    const deleteButton = screen.getByRole('button', { name: '' }); // IconButton without aria-label
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith(null);
    });
  });

  it('displays error message', () => {
    const handleChange = vi.fn();

    render(
      <DocumentUploadRenderer
        fieldDefinition={mockFieldDefinition}
        value={null}
        onChange={handleChange}
        error="File is required"
      />
    );

    expect(screen.getByText('File is required')).toBeInTheDocument();
  });

  it('disables upload when disabled prop is true', () => {
    const handleChange = vi.fn();

    render(
      <DocumentUploadRenderer
        fieldDefinition={mockFieldDefinition}
        value={null}
        onChange={handleChange}
        disabled
      />
    );

    const button = screen.getByText('Choose Files');
    expect(button).toBeDisabled();
  });

  it('shows required indicator', () => {
    const handleChange = vi.fn();

    render(
      <DocumentUploadRenderer
        fieldDefinition={mockFieldDefinition}
        value={null}
        onChange={handleChange}
        required
      />
    );

    const label = screen.getByText('Upload Document');
    expect(label.parentElement).toHaveTextContent('*');
  });

  it('handles multiple file selection', async () => {
    const handleChange = vi.fn();
    const files = [
      new File(['content1'], 'file1.pdf', { type: 'application/pdf' }),
      new File(['content2'], 'file2.pdf', { type: 'application/pdf' }),
    ];

    render(
      <DocumentUploadRenderer
        fieldDefinition={mockFieldDefinition}
        value={null}
        onChange={handleChange}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: files,
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith(files);
    });
  });
});
