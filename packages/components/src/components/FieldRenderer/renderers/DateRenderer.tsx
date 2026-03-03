import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import type { FieldDefinition } from '../../../types';

export interface DateRendererProps {
  fieldDefinition: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
  onBlur?: () => void;
  error?: string | null;
  disabled?: boolean;
  required?: boolean;
}

/**
 * DateRenderer for date, time, and datetime datatypes using MUI X Date Pickers.
 * 
 * **IMPORTANT: LocalizationProvider Requirement**
 * 
 * This component MUST be wrapped in a `LocalizationProvider` from `@mui/x-date-pickers`
 * in the parent component tree. Without it, the date pickers will throw a context error:
 * "Can not find utils in context. It looks like you forgot to wrap your component in LocalizationProvider."
 * 
 * The LocalizationProvider is intentionally NOT included in this component to avoid Vite
 * module resolution issues in monorepo development mode, where multiple instances of
 * `@mui/x-date-pickers` could break React context propagation.
 * 
 * @example
 * ```tsx
 * import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
 * import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
 * import { enGB } from 'date-fns/locale';
 * import { DateRenderer } from '@aws-web-framework/components';
 * 
 * function MyFormPage() {
 *   return (
 *     <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
 *       <DateRenderer
 *         fieldDefinition={myDateField}
 *         value={dateValue}
 *         onChange={handleChange}
 *       />
 *     </LocalizationProvider>
 *   );
 * }
 * ```
 * 
 * @param props - DateRenderer component props
 * @param props.fieldDefinition - Field definition with datatype 'date', 'time', or 'datetime'
 * @param props.value - Current date value (ISO string or null)
 * @param props.onChange - Callback when date value changes, receives ISO string or null
 * @param props.onBlur - Optional callback when field loses focus
 * @param props.error - Optional error message to display
 * @param props.disabled - Whether the field is disabled
 * @param props.required - Whether the field is required
 * @returns JSX element rendering the appropriate date picker component
 * 
 * @see {@link https://mui.com/x/react-date-pickers/getting-started/ MUI X Date Pickers Documentation}
 */
export function DateRenderer({
  fieldDefinition,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  required = false,
}: DateRendererProps): JSX.Element {
  const dateValue = value ? new Date(value) : null;

  const handleChange = (newValue: Date | null) => {
    onChange(newValue ? newValue.toISOString() : null);
  };

  const commonProps = {
    label: fieldDefinition.displayName,
    value: dateValue,
    onChange: handleChange,
    disabled,
    slotProps: {
      textField: {
        fullWidth: true,
        error: !!error,
        helperText: error || fieldDefinition.description,
        required: required,
        onBlur: onBlur,
      },
    },
  };

  // Date pickers rely on LocalizationProvider from parent component
  // This avoids Vite module resolution issues with nested providers
  return (
    <>
      {fieldDefinition.datatype === 'date' && <DatePicker {...commonProps} />}
      {fieldDefinition.datatype === 'time' && <TimePicker {...commonProps} />}
      {fieldDefinition.datatype === 'datetime' && <DateTimePicker {...commonProps} />}
    </>
  );
}
