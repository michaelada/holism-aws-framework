/**
 * Unit Tests for FieldRenderer Component
 * Tests rendering with various field configurations and validation error display
 * Validates: Requirements 22.2
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { FieldRenderer } from '../FieldRenderer';
import { FieldDatatype, type FieldDefinition } from '../../../types';

/**
 * Date, time and datetime fields render MUI pickers, which read their adapter
 * from a `LocalizationProvider` the host app supplies — without one they refuse
 * to render at all.
 */
const renderWithPickers = (ui: React.ReactElement) =>
  render(<LocalizationProvider dateAdapter={AdapterDateFns}>{ui}</LocalizationProvider>);

describe('FieldRenderer', () => {
  describe('TextRenderer', () => {
    it('should render text input for text datatype', () => {
      const fieldDef: FieldDefinition = {
        shortName: 'test_text',
        displayName: 'Test Text',
        description: 'A test text field',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
        validationRules: [],
      };

      const { container } = render(
        <FieldRenderer fieldDefinition={fieldDef} value="" onChange={() => {}} />
      );

      expect(screen.getByLabelText('Test Text')).toBeTruthy();
      expect(container.querySelector('input[type="text"]')).toBeTruthy();
    });

    it('should render textarea for text_area datatype', () => {
      const fieldDef: FieldDefinition = {
        shortName: 'test_textarea',
        displayName: 'Test Textarea',
        description: 'A test textarea field',
        datatype: FieldDatatype.TEXT_AREA,
        datatypeProperties: {},
        validationRules: [],
      };

      const { container } = render(
        <FieldRenderer fieldDefinition={fieldDef} value="" onChange={() => {}} />
      );

      expect(screen.getByLabelText('Test Textarea')).toBeTruthy();
      expect(container.querySelector('textarea')).toBeTruthy();
    });

    it('should render email input for email datatype', () => {
      const fieldDef: FieldDefinition = {
        shortName: 'test_email',
        displayName: 'Test Email',
        description: 'A test email field',
        datatype: FieldDatatype.EMAIL,
        datatypeProperties: {},
        validationRules: [],
      };

      const { container } = render(
        <FieldRenderer fieldDefinition={fieldDef} value="" onChange={() => {}} />
      );

      expect(screen.getByLabelText('Test Email')).toBeTruthy();
      expect(container.querySelector('input[type="email"]')).toBeTruthy();
    });

    it('should display validation error', () => {
      const fieldDef: FieldDefinition = {
        shortName: 'test_text',
        displayName: 'Test Text',
        description: 'A test text field',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
        validationRules: [],
      };

      render(
        <FieldRenderer
          fieldDefinition={fieldDef}
          value=""
          onChange={() => {}}
          error="This field is required"
        />
      );

      expect(screen.getByText('This field is required')).toBeTruthy();
    });
  });

  describe('NumberRenderer', () => {
    it('should render number input', () => {
      const fieldDef: FieldDefinition = {
        shortName: 'test_number',
        displayName: 'Test Number',
        description: 'A test number field',
        datatype: FieldDatatype.NUMBER,
        datatypeProperties: {},
        validationRules: [],
      };

      const { container } = render(
        <FieldRenderer fieldDefinition={fieldDef} value={null} onChange={() => {}} />
      );

      expect(screen.getByLabelText('Test Number')).toBeTruthy();
      expect(container.querySelector('input[type="number"]')).toBeTruthy();
    });

    it('should handle number value changes', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const fieldDef: FieldDefinition = {
        shortName: 'test_number',
        displayName: 'Test Number',
        description: 'A test number field',
        datatype: FieldDatatype.NUMBER,
        datatypeProperties: {},
        validationRules: [],
      };

      const { container } = render(
        <FieldRenderer fieldDefinition={fieldDef} value={null} onChange={onChange} />
      );

      const input = container.querySelector('input[type="number"]');
      expect(input).toBeTruthy();

      await user.type(input!, '42');
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('BooleanRenderer', () => {
    it('should render checkbox', () => {
      const fieldDef: FieldDefinition = {
        shortName: 'test_boolean',
        displayName: 'Test Boolean',
        description: 'A test boolean field',
        datatype: FieldDatatype.BOOLEAN,
        datatypeProperties: {},
        validationRules: [],
      };

      const { container } = render(
        <FieldRenderer fieldDefinition={fieldDef} value={false} onChange={() => {}} />
      );

      expect(screen.getByLabelText('Test Boolean')).toBeTruthy();
      expect(container.querySelector('input[type="checkbox"]')).toBeTruthy();
    });

    it('should handle checkbox changes', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const fieldDef: FieldDefinition = {
        shortName: 'test_boolean',
        displayName: 'Test Boolean',
        description: 'A test boolean field',
        datatype: FieldDatatype.BOOLEAN,
        datatypeProperties: {},
        validationRules: [],
      };

      const { container } = render(
        <FieldRenderer fieldDefinition={fieldDef} value={false} onChange={onChange} />
      );

      const checkbox = container.querySelector('input[type="checkbox"]');
      expect(checkbox).toBeTruthy();

      await user.click(checkbox!);
      expect(onChange).toHaveBeenCalledWith(true);
    });
  });

  describe('DateRenderer', () => {
    it('should render date picker', () => {
      const fieldDef: FieldDefinition = {
        shortName: 'test_date',
        displayName: 'Test Date',
        description: 'A test date field',
        datatype: FieldDatatype.DATE,
        datatypeProperties: {},
        validationRules: [],
      };

      const { container } = renderWithPickers(
        <FieldRenderer fieldDefinition={fieldDef} value={null} onChange={() => {}} />
      );

      expect(screen.getByLabelText('Test Date')).toBeTruthy();
      expect(container.querySelector('input')).toBeTruthy();
    });

    it('should render time picker', () => {
      const fieldDef: FieldDefinition = {
        shortName: 'test_time',
        displayName: 'Test Time',
        description: 'A test time field',
        datatype: FieldDatatype.TIME,
        datatypeProperties: {},
        validationRules: [],
      };

      const { container } = renderWithPickers(
        <FieldRenderer fieldDefinition={fieldDef} value={null} onChange={() => {}} />
      );

      expect(screen.getByLabelText('Test Time')).toBeTruthy();
      expect(container.querySelector('input')).toBeTruthy();
    });

    it('should render datetime picker', () => {
      const fieldDef: FieldDefinition = {
        shortName: 'test_datetime',
        displayName: 'Test DateTime',
        description: 'A test datetime field',
        datatype: FieldDatatype.DATETIME,
        datatypeProperties: {},
        validationRules: [],
      };

      const { container } = renderWithPickers(
        <FieldRenderer fieldDefinition={fieldDef} value={null} onChange={() => {}} />
      );

      expect(screen.getByLabelText('Test DateTime')).toBeTruthy();
      expect(container.querySelector('input')).toBeTruthy();
    });
  });

  describe('SelectRenderer', () => {
    it('should render radio buttons when displayMode is radio', () => {
      const fieldDef: FieldDefinition = {
        shortName: 'test_select',
        displayName: 'Test Select',
        description: 'A test select field',
        datatype: FieldDatatype.SINGLE_SELECT,
        datatypeProperties: {
          displayMode: 'radio',
          options: [
            { value: 'option1', label: 'Option 1' },
            { value: 'option2', label: 'Option 2' },
          ],
        },
        validationRules: [],
      };

      const { container } = render(
        <FieldRenderer fieldDefinition={fieldDef} value="" onChange={() => {}} />
      );

      expect(screen.getByText('Test Select')).toBeTruthy();
      expect(container.querySelectorAll('input[type="radio"]').length).toBe(2);
    });

    it('should render dropdown when displayMode is dropdown', () => {
      const fieldDef: FieldDefinition = {
        shortName: 'test_select',
        displayName: 'Test Select',
        description: 'A test select field',
        datatype: FieldDatatype.SINGLE_SELECT,
        datatypeProperties: {
          displayMode: 'dropdown',
          options: [
            { value: 'option1', label: 'Option 1' },
            { value: 'option2', label: 'Option 2' },
          ],
        },
        validationRules: [],
      };

      const { container } = render(
        <FieldRenderer fieldDefinition={fieldDef} value="" onChange={() => {}} />
      );

      // Check for dropdown combobox
      expect(container.querySelector('[role="combobox"]')).toBeTruthy();
      // Check that it's not radio buttons
      expect(container.querySelector('input[type="radio"]')).toBeFalsy();
    });
  });

  describe('MultiSelectRenderer', () => {
    it('should render multi-select dropdown', () => {
      const fieldDef: FieldDefinition = {
        shortName: 'test_multiselect',
        displayName: 'Test Multi-Select',
        description: 'A test multi-select field',
        datatype: FieldDatatype.MULTI_SELECT,
        datatypeProperties: {
          options: [
            { value: 'option1', label: 'Option 1' },
            { value: 'option2', label: 'Option 2' },
            { value: 'option3', label: 'Option 3' },
          ],
        },
        validationRules: [],
      };

      const { container } = render(
        <FieldRenderer fieldDefinition={fieldDef} value={[]} onChange={() => {}} />
      );

      // Check for multi-select combobox
      expect(container.querySelector('[role="combobox"]')).toBeTruthy();
      // Check for multiple select class
      expect(container.querySelector('.MuiSelect-multiple')).toBeTruthy();
    });

    it('should display selected values as chips', () => {
      const fieldDef: FieldDefinition = {
        shortName: 'test_multiselect',
        displayName: 'Test Multi-Select',
        description: 'A test multi-select field',
        datatype: FieldDatatype.MULTI_SELECT,
        datatypeProperties: {
          options: [
            { value: 'option1', label: 'Option 1' },
            { value: 'option2', label: 'Option 2' },
          ],
        },
        validationRules: [],
      };

      render(
        <FieldRenderer
          fieldDefinition={fieldDef}
          value={['option1', 'option2']}
          onChange={() => {}}
        />
      );

      expect(screen.getByText('Option 1')).toBeTruthy();
      expect(screen.getByText('Option 2')).toBeTruthy();
    });
  });

  describe('Mandatory fields', () => {
    it('should mark mandatory fields with required attribute', () => {
      const fieldDef: FieldDefinition = {
        shortName: 'test_text',
        displayName: 'Test Text',
        description: 'A test text field',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
        validationRules: [],
      };

      const { container } = render(
        <FieldRenderer fieldDefinition={fieldDef} value="" onChange={() => {}} required={true} />
      );

      const input = container.querySelector('input');
      expect(input?.hasAttribute('required')).toBe(true);
    });
  });

  describe('Disabled state', () => {
    it('should disable input when disabled prop is true', () => {
      const fieldDef: FieldDefinition = {
        shortName: 'test_text',
        displayName: 'Test Text',
        description: 'A test text field',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
        validationRules: [],
      };

      const { container } = render(
        <FieldRenderer fieldDefinition={fieldDef} value="" onChange={() => {}} disabled={true} />
      );

      const input = container.querySelector('input');
      expect(input?.hasAttribute('disabled')).toBe(true);
    });
  });
});

/**
 * A date the member has just picked is not an invalid date.
 *
 * Two faults, one symptom: opening a picker and choosing a date left the field
 * red under a perfectly good answer, reading "Must be a valid date".
 *
 *  - Closing the popover **blurs the input**, and the blur ran before the
 *    chosen date came back down as a prop — so validation saw the *empty*
 *    field the member had just filled in.
 *  - Yup casts `''` to an Invalid Date, so an empty date field was reported as
 *    a wrong one. "Not filled in" is not "filled in wrongly"; whether it may be
 *    empty is the required rule's business.
 */
describe('FieldRenderer — a date field that has just been filled in', () => {
  const dateField: FieldDefinition = {
    shortName: 'dob',
    displayName: 'Date of birth',
    description: '',
    datatype: FieldDatatype.DATE,
    datatypeProperties: {},
    validationRules: [],
  };

  it('does not call an empty date field invalid', async () => {
    const { container } = renderWithPickers(
      <FieldRenderer fieldDefinition={dateField} value="" onChange={() => {}} />
    );

    const input = container.querySelector('input')!;
    await userEvent.click(input);
    await userEvent.tab();

    expect(screen.queryByText('Must be a valid date')).toBeNull();
  });

  it('validates the value it has now, not the one it had before the blur', async () => {
    /*
     * The picker's own blur arrives before the parent's state does. Validating
     * the prop as it was at render time meant reporting the empty field.
     */
    const { container, rerender } = renderWithPickers(
      <FieldRenderer fieldDefinition={dateField} value="" onChange={() => {}} />
    );

    rerender(
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <FieldRenderer
          fieldDefinition={dateField}
          value={new Date('2012-05-04').toISOString()}
          onChange={() => {}}
        />
      </LocalizationProvider>
    );

    const input = container.querySelector('input')!;
    await userEvent.click(input);
    await userEvent.tab();

    expect(screen.queryByText('Must be a valid date')).toBeNull();
  });

  it('still says so when what is in the box is not a date', async () => {
    // The check is not weakened: a real error is still raised on blur.
    const { container } = renderWithPickers(
      <FieldRenderer fieldDefinition={dateField} value="the fourth of May" onChange={() => {}} />
    );

    const input = container.querySelector('input')!;
    await userEvent.click(input);
    await userEvent.tab();

    expect(await screen.findByText('Must be a valid date')).toBeTruthy();
  });

  it('clears an error once the value is corrected, without waiting for a blur', async () => {
    // On a picker there may be no second blur to clear it, so the field stayed
    // red under an answer that was already right.
    const { container, rerender } = renderWithPickers(
      <FieldRenderer fieldDefinition={dateField} value="the fourth of May" onChange={() => {}} />
    );

    const input = container.querySelector('input')!;
    await userEvent.click(input);
    await userEvent.tab();
    expect(await screen.findByText('Must be a valid date')).toBeTruthy();

    rerender(
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <FieldRenderer
          fieldDefinition={dateField}
          value={new Date('2012-05-04').toISOString()}
          onChange={() => {}}
        />
      </LocalizationProvider>
    );

    await waitFor(() => expect(screen.queryByText('Must be a valid date')).toBeNull());
  });
});
