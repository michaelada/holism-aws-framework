/**
 * Unit Tests for MetadataWizard Component
 * Tests wizard rendering, step navigation, and data collection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MetadataWizard } from '../MetadataWizard';
import type { ObjectDefinition, FieldDefinition, WizardConfiguration } from '../../../types';
import { FieldDatatype } from '../../../types';
import * as metadataHook from '../../../hooks/useMetadata';

describe('MetadataWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  const createTestWizard = (stepCount: number = 2) => {
    const fields: FieldDefinition[] = Array.from({ length: stepCount }, (_, i) => ({
      shortName: `field_${i}`,
      displayName: `Field ${i + 1}`,
      description: `Field description ${i + 1}`,
      datatype: FieldDatatype.TEXT,
      datatypeProperties: {},
    }));

    const wizardConfig: WizardConfiguration = {
      steps: Array.from({ length: stepCount }, (_, i) => ({
        name: `Step ${i + 1}`,
        description: `Description for step ${i + 1}`,
        fields: [`field_${i}`],
        order: i,
      })),
    };

    const objectDef: ObjectDefinition = {
      shortName: 'test_wizard',
      displayName: 'Test Wizard',
      description: 'A test wizard object',
      fields: fields.map((f, i) => ({
        fieldShortName: f.shortName,
        order: i,
      })),
      displayProperties: {},
      wizardConfig,
    };

    return { objectDef, fields };
  };

  describe('Rendering', () => {
    it('should render wizard with stepper', () => {
      const { objectDef, fields } = createTestWizard(3);

      vi.spyOn(metadataHook, 'useMetadata').mockReturnValue({
        objectDef,
        fields,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { container } = render(
        <MetadataWizard
          objectType="test_wizard"
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Verify stepper is rendered
      expect(container.querySelector('.MuiStepper-root')).toBeTruthy();

      // Verify all steps are shown
      const stepLabels = container.querySelectorAll('.MuiStepLabel-label');
      expect(stepLabels.length).toBe(3);
    });

    it('should render object display name and description', () => {
      const { objectDef, fields } = createTestWizard(2);

      vi.spyOn(metadataHook, 'useMetadata').mockReturnValue({
        objectDef,
        fields,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <MetadataWizard
          objectType="test_wizard"
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByText('Test Wizard')).toBeTruthy();
      expect(screen.getByText('A test wizard object')).toBeTruthy();
    });

    it('should render first step by default', () => {
      const { objectDef, fields } = createTestWizard(2);

      vi.spyOn(metadataHook, 'useMetadata').mockReturnValue({
        objectDef,
        fields,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { container } = render(
        <MetadataWizard
          objectType="test_wizard"
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Verify step 1 heading is displayed (h6 element)
      const stepHeading = Array.from(container.querySelectorAll('h6')).find(
        (el) => el.textContent === 'Step 1'
      );
      expect(stepHeading).toBeTruthy();

      expect(screen.getByText('Description for step 1')).toBeTruthy();
      
      // Verify field label is present
      const fieldLabel = container.querySelector('label[for^=":r"]');
      expect(fieldLabel?.textContent).toBe('Field 1');
    });

    it('should show loading state', () => {
      vi.spyOn(metadataHook, 'useMetadata').mockReturnValue({
        objectDef: null,
        fields: [],
        loading: true,
        error: null,
        refetch: vi.fn(),
      });

      const { container } = render(
        <MetadataWizard
          objectType="test_wizard"
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(container.querySelector('.MuiCircularProgress-root')).toBeTruthy();
    });

    it('should show error when metadata fails to load', () => {
      vi.spyOn(metadataHook, 'useMetadata').mockReturnValue({
        objectDef: null,
        fields: [],
        loading: false,
        error: new Error('Failed to load metadata'),
        refetch: vi.fn(),
      });

      render(
        <MetadataWizard
          objectType="test_wizard"
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByText(/Failed to load metadata/i)).toBeTruthy();
    });

    it('should show error when object has no wizard config', () => {
      const objectDef: ObjectDefinition = {
        shortName: 'test_object',
        displayName: 'Test Object',
        description: 'Test',
        fields: [],
        displayProperties: {},
        // No wizardConfig
      };

      vi.spyOn(metadataHook, 'useMetadata').mockReturnValue({
        objectDef,
        fields: [],
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <MetadataWizard
          objectType="test_object"
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByText(/does not have wizard configuration/i)).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('should navigate to next step when Next is clicked', async () => {
      const { objectDef, fields } = createTestWizard(2);

      vi.spyOn(metadataHook, 'useMetadata').mockReturnValue({
        objectDef,
        fields,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { container } = render(
        <MetadataWizard
          objectType="test_wizard"
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Fill field
      const input = container.querySelector('input[type="text"]');
      if (input) {
        fireEvent.change(input, { target: { value: 'test value' } });
      }

      // Click Next
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      // Wait for step 2 to be active
      await waitFor(() => {
        const activeSteps = container.querySelectorAll('.MuiStepLabel-label.Mui-active');
        expect(activeSteps[0].textContent).toBe('Step 2');
      });
    });

    it('should navigate to previous step when Back is clicked', async () => {
      const { objectDef, fields } = createTestWizard(2);

      vi.spyOn(metadataHook, 'useMetadata').mockReturnValue({
        objectDef,
        fields,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { container } = render(
        <MetadataWizard
          objectType="test_wizard"
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Navigate to step 2
      const input = container.querySelector('input[type="text"]');
      if (input) {
        fireEvent.change(input, { target: { value: 'test value' } });
      }

      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      await waitFor(() => {
        const activeSteps = container.querySelectorAll('.MuiStepLabel-label.Mui-active');
        expect(activeSteps[0].textContent).toBe('Step 2');
      });

      // Click Back
      const backButton = screen.getByText('Back');
      fireEvent.click(backButton);

      // Wait for step 1 to be active again
      await waitFor(() => {
        const activeSteps = container.querySelectorAll('.MuiStepLabel-label.Mui-active');
        expect(activeSteps[0].textContent).toBe('Step 1');
      });
    });

    it('should show Cancel button on first step', () => {
      const { objectDef, fields } = createTestWizard(2);

      vi.spyOn(metadataHook, 'useMetadata').mockReturnValue({
        objectDef,
        fields,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <MetadataWizard
          objectType="test_wizard"
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByText('Cancel')).toBeTruthy();
    });

    it('should show Complete button on last step', async () => {
      const { objectDef, fields } = createTestWizard(2);

      vi.spyOn(metadataHook, 'useMetadata').mockReturnValue({
        objectDef,
        fields,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { container } = render(
        <MetadataWizard
          objectType="test_wizard"
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Navigate to last step
      const input = container.querySelector('input[type="text"]');
      if (input) {
        fireEvent.change(input, { target: { value: 'test value' } });
      }

      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Complete')).toBeTruthy();
      });
    });
  });

  describe('Data Collection and Submission', () => {
    it('should call onComplete with all collected data', async () => {
      const { objectDef, fields } = createTestWizard(2);
      const onComplete = vi.fn();

      vi.spyOn(metadataHook, 'useMetadata').mockReturnValue({
        objectDef,
        fields,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { container } = render(
        <MetadataWizard
          objectType="test_wizard"
          onComplete={onComplete}
          onCancel={vi.fn()}
        />
      );

      // Fill step 1
      const input1 = container.querySelector('input[type="text"]');
      if (input1) {
        fireEvent.change(input1, { target: { value: 'value1' } });
      }

      fireEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        const activeSteps = container.querySelectorAll('.MuiStepLabel-label.Mui-active');
        expect(activeSteps[0].textContent).toBe('Step 2');
      });

      // Fill step 2
      const input2 = container.querySelector('input[type="text"]');
      if (input2) {
        fireEvent.change(input2, { target: { value: 'value2' } });
      }

      fireEvent.click(screen.getByText('Complete'));

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith({
          field_0: 'value1',
          field_1: 'value2',
        });
      });
    });

    it('should call onCancel when Cancel is clicked on first step', () => {
      const { objectDef, fields } = createTestWizard(2);
      const onCancel = vi.fn();

      vi.spyOn(metadataHook, 'useMetadata').mockReturnValue({
        objectDef,
        fields,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <MetadataWizard
          objectType="test_wizard"
          onComplete={vi.fn()}
          onCancel={onCancel}
        />
      );

      fireEvent.click(screen.getByText('Cancel'));

      expect(onCancel).toHaveBeenCalled();
    });
  });
});
