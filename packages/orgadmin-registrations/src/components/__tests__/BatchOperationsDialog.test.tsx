/**
 * Unit Tests for BatchOperationsDialog
 *
 * Feature: registrations-module
 * Tests: mark processed API call, mark unprocessed API call,
 *        add labels dialog and API call, remove labels dialog and API call,
 *        selection cleared on success
 *
 * Requirements: 5.2, 5.3, 5.4, 5.5, 5.6
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mock setup ──

const mockExecute = vi.fn();

vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useTranslation: () => ({ t: (k: string, params?: any) => params ? `${k} ${JSON.stringify(params)}` : k }),
}));

vi.mock('@aws-web-framework/orgadmin-core', () => ({
  useApi: () => ({ execute: mockExecute }),
}));

import BatchOperationsDialog from '../BatchOperationsDialog';

// ── Test data ──

const selectedIds = ['reg-1', 'reg-2', 'reg-3'];

// ── Tests ──

describe('BatchOperationsDialog - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Requirement 5.2: Mark processed API call
   */
  describe('Mark processed (Requirement 5.2)', () => {
    it('sends POST to mark-processed endpoint with selected IDs', async () => {
      mockExecute.mockResolvedValue({});
      const onComplete = vi.fn();
      const onClose = vi.fn();

      render(
        <BatchOperationsDialog
          open={true}
          onClose={onClose}
          operation="mark_processed"
          selectedIds={selectedIds}
          onComplete={onComplete}
        />,
      );

      const executeButton = screen.getByTestId('execute-button');
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledTimes(1);
      });

      const call = mockExecute.mock.calls[0][0];
      expect(call.method).toBe('POST');
      expect(call.url).toBe('/api/orgadmin/registrations/batch/mark-processed');
      expect(call.data).toEqual({ registrationIds: selectedIds });
    });
  });

  /**
   * Requirement 5.3: Mark unprocessed API call
   */
  describe('Mark unprocessed (Requirement 5.3)', () => {
    it('sends POST to mark-unprocessed endpoint with selected IDs', async () => {
      mockExecute.mockResolvedValue({});
      const onComplete = vi.fn();
      const onClose = vi.fn();

      render(
        <BatchOperationsDialog
          open={true}
          onClose={onClose}
          operation="mark_unprocessed"
          selectedIds={selectedIds}
          onComplete={onComplete}
        />,
      );

      const executeButton = screen.getByTestId('execute-button');
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledTimes(1);
      });

      const call = mockExecute.mock.calls[0][0];
      expect(call.method).toBe('POST');
      expect(call.url).toBe('/api/orgadmin/registrations/batch/mark-unprocessed');
      expect(call.data).toEqual({ registrationIds: selectedIds });
    });
  });

  /**
   * Requirement 5.4: Add labels dialog and API call
   */
  describe('Add labels (Requirement 5.4)', () => {
    it('shows label input UI and sends POST with IDs and labels', async () => {
      mockExecute.mockResolvedValue({});
      const onComplete = vi.fn();
      const onClose = vi.fn();

      render(
        <BatchOperationsDialog
          open={true}
          onClose={onClose}
          operation="add_labels"
          selectedIds={selectedIds}
          onComplete={onComplete}
        />,
      );

      // Label input UI should be visible
      const labelInput = screen.getByTestId('label-input').querySelector('input')!;
      const addLabelButton = screen.getByTestId('add-label-button');
      expect(labelInput).toBeInTheDocument();
      expect(addLabelButton).toBeInTheDocument();

      // Execute button should be disabled until labels are added
      const executeButton = screen.getByTestId('execute-button');
      expect(executeButton).toBeDisabled();

      // Add labels
      fireEvent.change(labelInput, { target: { value: 'VIP' } });
      fireEvent.click(addLabelButton);
      fireEvent.change(labelInput, { target: { value: 'Priority' } });
      fireEvent.click(addLabelButton);

      // Execute button should now be enabled
      expect(executeButton).not.toBeDisabled();

      // Labels should appear as chips
      expect(screen.getByText('VIP')).toBeInTheDocument();
      expect(screen.getByText('Priority')).toBeInTheDocument();

      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledTimes(1);
      });

      const call = mockExecute.mock.calls[0][0];
      expect(call.method).toBe('POST');
      expect(call.url).toBe('/api/orgadmin/registrations/batch/add-labels');
      expect(call.data).toEqual({
        registrationIds: selectedIds,
        labels: ['VIP', 'Priority'],
      });
    });
  });

  /**
   * Requirement 5.5: Remove labels dialog and API call
   */
  describe('Remove labels (Requirement 5.5)', () => {
    it('shows label input UI and sends POST with IDs and labels', async () => {
      mockExecute.mockResolvedValue({});
      const onComplete = vi.fn();
      const onClose = vi.fn();

      render(
        <BatchOperationsDialog
          open={true}
          onClose={onClose}
          operation="remove_labels"
          selectedIds={selectedIds}
          onComplete={onComplete}
        />,
      );

      // Label input UI should be visible
      const labelInput = screen.getByTestId('label-input').querySelector('input')!;
      const addLabelButton = screen.getByTestId('add-label-button');

      // Add labels to remove
      fireEvent.change(labelInput, { target: { value: 'Expired' } });
      fireEvent.click(addLabelButton);
      fireEvent.change(labelInput, { target: { value: 'Inactive' } });
      fireEvent.click(addLabelButton);

      expect(screen.getByText('Expired')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();

      const executeButton = screen.getByTestId('execute-button');
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledTimes(1);
      });

      const call = mockExecute.mock.calls[0][0];
      expect(call.method).toBe('POST');
      expect(call.url).toBe('/api/orgadmin/registrations/batch/remove-labels');
      expect(call.data).toEqual({
        registrationIds: selectedIds,
        labels: ['Expired', 'Inactive'],
      });
    });
  });

  /**
   * Requirement 5.6: Selection cleared on success
   */
  describe('Selection cleared on success (Requirement 5.6)', () => {
    it('calls onComplete after successful mark processed operation', async () => {
      mockExecute.mockResolvedValue({});
      const onComplete = vi.fn();
      const onClose = vi.fn();

      render(
        <BatchOperationsDialog
          open={true}
          onClose={onClose}
          operation="mark_processed"
          selectedIds={selectedIds}
          onComplete={onComplete}
        />,
      );

      fireEvent.click(screen.getByTestId('execute-button'));

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledTimes(1);
      });
    });

    it('calls onComplete after successful add labels operation', async () => {
      mockExecute.mockResolvedValue({});
      const onComplete = vi.fn();
      const onClose = vi.fn();

      render(
        <BatchOperationsDialog
          open={true}
          onClose={onClose}
          operation="add_labels"
          selectedIds={selectedIds}
          onComplete={onComplete}
        />,
      );

      // Add a label first
      const labelInput = screen.getByTestId('label-input').querySelector('input')!;
      fireEvent.change(labelInput, { target: { value: 'TestLabel' } });
      fireEvent.click(screen.getByTestId('add-label-button'));

      fireEvent.click(screen.getByTestId('execute-button'));

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledTimes(1);
      });
    });

    it('does NOT call onComplete when API call fails', async () => {
      mockExecute.mockRejectedValue(new Error('API Error'));
      const onComplete = vi.fn();
      const onClose = vi.fn();

      render(
        <BatchOperationsDialog
          open={true}
          onClose={onClose}
          operation="mark_processed"
          selectedIds={selectedIds}
          onComplete={onComplete}
        />,
      );

      fireEvent.click(screen.getByTestId('execute-button'));

      // Wait for error to be displayed
      await waitFor(() => {
        expect(screen.getByText('registrations.batch.error')).toBeInTheDocument();
      });

      expect(onComplete).not.toHaveBeenCalled();
    });
  });
});
