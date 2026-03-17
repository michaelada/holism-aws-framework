/**
 * Property-Based Tests for BatchOperationsDialog
 *
 * Feature: registrations-module
 * Properties 11, 12, 13
 *
 * Tests batch mark processed/unprocessed requests, batch add/remove labels requests,
 * and batch operation completion clearing selection.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import fc from 'fast-check';

// ── Mock setup (hoisted before component import) ──

const mockExecute = vi.fn();

vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useTranslation: () => ({ t: (k: string, params?: any) => params ? `${k} ${JSON.stringify(params)}` : k }),
}));

vi.mock('@aws-web-framework/orgadmin-core', () => ({
  useApi: () => ({ execute: mockExecute }),
}));

// ── Import component after mocks ──
import BatchOperationsDialog from '../BatchOperationsDialog';
import type { BatchOperationType } from '../../types/registration.types';

// ── Generators ──

const registrationIdArb = fc.uuid();
const nonEmptyIdsArb = fc.array(registrationIdArb, { minLength: 1, maxLength: 10 });
const labelArb = fc.string({ minLength: 1, maxLength: 20 }).map(s => s.trim()).filter(s => s.length > 0);
const nonEmptyLabelsArb = fc.array(labelArb, { minLength: 1, maxLength: 5 }).map(labels => [...new Set(labels)]).filter(labels => labels.length > 0);

// ── Property 11: Batch mark processed/unprocessed sends correct request ──

describe('Feature: registrations-module, Property 11: Batch mark processed/unprocessed sends correct request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 11: For any non-empty set of registration IDs and either mark-processed
   * or mark-unprocessed operation, the module should send a POST request to the
   * corresponding batch endpoint with exactly those IDs.
   *
   * **Validates: Requirements 5.2, 5.3**
   */
  it('sends POST to correct endpoint with exact registration IDs for mark operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonEmptyIdsArb,
        fc.constantFrom('mark_processed' as const, 'mark_unprocessed' as const),
        async (selectedIds, operation) => {
          cleanup();
          vi.clearAllMocks();
          mockExecute.mockResolvedValue({});

          const onComplete = vi.fn();
          const onClose = vi.fn();

          const { unmount, container } = render(
            <BatchOperationsDialog
              open={true}
              onClose={onClose}
              operation={operation}
              selectedIds={selectedIds}
              onComplete={onComplete}
            />,
          );

          const view = within(document.body);

          // Click the execute button (mark operations show confirmation, no label input needed)
          const executeButton = view.getByTestId('execute-button');
          fireEvent.click(executeButton);

          await waitFor(() => {
            expect(mockExecute).toHaveBeenCalledTimes(1);
          });

          const call = mockExecute.mock.calls[0][0];
          const expectedEndpoint = operation === 'mark_processed'
            ? '/api/orgadmin/registrations/batch/mark-processed'
            : '/api/orgadmin/registrations/batch/mark-unprocessed';

          expect(call.method).toBe('POST');
          expect(call.url).toBe(expectedEndpoint);
          expect(call.data.registrationIds).toEqual(selectedIds);

          unmount();
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── Property 12: Batch add/remove labels sends correct request ──

describe('Feature: registrations-module, Property 12: Batch add/remove labels sends correct request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 12: For any non-empty set of registration IDs and any set of labels,
   * the add-labels and remove-labels batch operations should send a POST request
   * to the corresponding endpoint with exactly those IDs and labels.
   *
   * **Validates: Requirements 5.4, 5.5**
   */
  it('sends POST to correct endpoint with exact registration IDs and labels for label operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonEmptyIdsArb,
        nonEmptyLabelsArb,
        fc.constantFrom('add_labels' as const, 'remove_labels' as const),
        async (selectedIds, labels, operation) => {
          cleanup();
          vi.clearAllMocks();
          mockExecute.mockResolvedValue({});

          const onComplete = vi.fn();
          const onClose = vi.fn();

          const { unmount } = render(
            <BatchOperationsDialog
              open={true}
              onClose={onClose}
              operation={operation}
              selectedIds={selectedIds}
              onComplete={onComplete}
            />,
          );

          const view = within(document.body);

          // For label operations, we need to add labels first
          const labelInput = view.getByTestId('label-input').querySelector('input')!;
          const addLabelButton = view.getByTestId('add-label-button');

          for (const label of labels) {
            fireEvent.change(labelInput, { target: { value: label } });
            fireEvent.click(addLabelButton);
          }

          // Now click execute
          const executeButton = view.getByTestId('execute-button');
          fireEvent.click(executeButton);

          await waitFor(() => {
            expect(mockExecute).toHaveBeenCalledTimes(1);
          });

          const call = mockExecute.mock.calls[0][0];
          const expectedEndpoint = operation === 'add_labels'
            ? '/api/orgadmin/registrations/batch/add-labels'
            : '/api/orgadmin/registrations/batch/remove-labels';

          expect(call.method).toBe('POST');
          expect(call.url).toBe(expectedEndpoint);
          expect(call.data.registrationIds).toEqual(selectedIds);
          expect(call.data.labels).toEqual(labels);

          unmount();
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── Property 13: Batch operation completion clears selection ──

describe('Feature: registrations-module, Property 13: Batch operation completion clears selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 13: For any batch operation that completes successfully,
   * onComplete is called (which clears selection in the parent).
   *
   * **Validates: Requirements 5.6**
   */
  it('calls onComplete on successful batch operation completion', async () => {
    const allOperations: BatchOperationType[] = ['mark_processed', 'mark_unprocessed', 'add_labels', 'remove_labels'];

    await fc.assert(
      fc.asyncProperty(
        nonEmptyIdsArb,
        fc.constantFrom(...allOperations),
        async (selectedIds, operation) => {
          cleanup();
          vi.clearAllMocks();
          mockExecute.mockResolvedValue({});

          const onComplete = vi.fn();
          const onClose = vi.fn();

          const { unmount } = render(
            <BatchOperationsDialog
              open={true}
              onClose={onClose}
              operation={operation}
              selectedIds={selectedIds}
              onComplete={onComplete}
            />,
          );

          const view = within(document.body);
          const isLabelOp = operation === 'add_labels' || operation === 'remove_labels';

          // For label operations, add at least one label first
          if (isLabelOp) {
            const labelInput = view.getByTestId('label-input').querySelector('input')!;
            const addLabelButton = view.getByTestId('add-label-button');
            fireEvent.change(labelInput, { target: { value: 'test-label' } });
            fireEvent.click(addLabelButton);
          }

          // Click execute
          const executeButton = view.getByTestId('execute-button');
          fireEvent.click(executeButton);

          // Wait for onComplete to be called
          await waitFor(() => {
            expect(onComplete).toHaveBeenCalledTimes(1);
          });

          unmount();
        },
      ),
      { numRuns: 20 },
    );
  });
});
