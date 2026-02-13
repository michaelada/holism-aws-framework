import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { FileUpload, UploadedFile } from '../FileUpload';

describe('FileUpload', () => {
  it('renders upload area', () => {
    const handleChange = vi.fn();

    render(<FileUpload value={[]} onChange={handleChange} label="Upload Files" />);

    expect(screen.getByText('Upload Files')).toBeInTheDocument();
    expect(screen.getByText('Choose Files')).toBeInTheDocument();
  });

  it('validates file size', async () => {
    const handleChange = vi.fn();
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.pdf', {
      type: 'application/pdf',
    });

    render(<FileUpload value={[]} onChange={handleChange} maxSize={10 * 1024 * 1024} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [largeFile],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalled();
      const uploadedFiles = handleChange.mock.calls[0][0] as UploadedFile[];
      expect(uploadedFiles[0].status).toBe('error');
      expect(uploadedFiles[0].error).toContain('exceeds maximum');
    });
  });

  it('displays uploaded files', () => {
    const handleChange = vi.fn();
    const files: UploadedFile[] = [
      {
        id: '1',
        name: 'document.pdf',
        size: 1024,
        status: 'success',
      },
    ];

    render(<FileUpload value={files} onChange={handleChange} />);

    expect(screen.getByText('document.pdf')).toBeInTheDocument();
    expect(screen.getByText('1.0 KB')).toBeInTheDocument();
  });

  it('removes file when delete clicked', async () => {
    const handleChange = vi.fn();
    const files: UploadedFile[] = [
      {
        id: '1',
        name: 'document.pdf',
        size: 1024,
        status: 'success',
      },
    ];

    render(<FileUpload value={files} onChange={handleChange} />);

    const deleteButton = screen.getByRole('button', { name: '' });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith([]);
    });
  });

  it('displays error message', () => {
    const handleChange = vi.fn();

    render(<FileUpload value={[]} onChange={handleChange} error="Files are required" />);

    expect(screen.getByText('Files are required')).toBeInTheDocument();
  });

  it('disables upload when disabled', () => {
    const handleChange = vi.fn();

    render(<FileUpload value={[]} onChange={handleChange} disabled />);

    const button = screen.getByText('Choose Files');
    expect(button).toBeDisabled();
  });

  it('shows upload progress', () => {
    const handleChange = vi.fn();
    const files: UploadedFile[] = [
      {
        id: '1',
        name: 'uploading.pdf',
        size: 1024,
        status: 'uploading',
        progress: 50,
      },
    ];

    render(<FileUpload value={files} onChange={handleChange} />);

    expect(screen.getByText('uploading.pdf')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays file size limits in helper text', () => {
    const handleChange = vi.fn();

    render(<FileUpload value={[]} onChange={handleChange} maxSize={5 * 1024 * 1024} />);

    expect(screen.getByText(/Maximum file size: 5.0 MB/)).toBeInTheDocument();
  });

  it('enforces max files limit', () => {
    const handleChange = vi.fn();
    const existingFiles: UploadedFile[] = [
      { id: '1', name: 'file1.pdf', size: 1024, status: 'success' },
      { id: '2', name: 'file2.pdf', size: 1024, status: 'success' },
    ];

    render(<FileUpload value={existingFiles} onChange={handleChange} maxFiles={2} />);

    expect(screen.getByText(/Maximum 2 files/)).toBeInTheDocument();
  });
});
