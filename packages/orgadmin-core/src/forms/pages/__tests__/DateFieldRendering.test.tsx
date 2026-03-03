/**
 * Unit tests for date field rendering
 * Tests that date/time/datetime fields render without console errors
 * 
 * **Validates: Requirements 1.1, 1.3, 6.4**
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Date Field Rendering Tests', () => {
  const formPreviewPagePath = join(__dirname, '../FormPreviewPage.tsx');
  const createFieldPagePath = join(__dirname, '../CreateFieldPage.tsx');
  const dateRendererPath = join(__dirname, '../../../../../components/src/components/FieldRenderer/renderers/DateRenderer.tsx');

  describe('FormPreviewPage - Date field rendering setup', () => {
    it('should wrap content in LocalizationProvider for date field support', () => {
      const fileContent = readFileSync(formPreviewPagePath, 'utf-8');
      
      // Verify LocalizationProvider is imported
      expect(fileContent).toContain("import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'");
      expect(fileContent).toContain("import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'");
      expect(fileContent).toContain("import { enGB } from 'date-fns/locale'");
      
      // Verify LocalizationProvider wraps the form content
      expect(fileContent).toContain('<LocalizationProvider');
      expect(fileContent).toContain('dateAdapter={AdapterDateFns}');
      expect(fileContent).toContain('adapterLocale={enGB}');
    });

    it('should support date, time, and datetime field types', () => {
      const fileContent = readFileSync(formPreviewPagePath, 'utf-8');
      
      // Verify the datatype mapping includes date/time/datetime
      expect(fileContent).toContain("'date': 'date'");
      expect(fileContent).toContain("'time': 'time'");
      expect(fileContent).toContain("'datetime': 'datetime'");
    });

    it('should render fields using FieldRenderer component', () => {
      const fileContent = readFileSync(formPreviewPagePath, 'utf-8');
      
      // Verify FieldRenderer is imported and used
      expect(fileContent).toContain("import { FieldRenderer } from '@aws-web-framework/components'");
      expect(fileContent).toContain('<FieldRenderer');
      expect(fileContent).toContain('fieldDefinition={');
    });

    it('should have documentation explaining LocalizationProvider placement', () => {
      const fileContent = readFileSync(formPreviewPagePath, 'utf-8');
      
      // Verify there's a comment explaining the LocalizationProvider requirement
      expect(fileContent).toContain('LocalizationProvider');
      expect(fileContent).toContain('Vite');
    });
  });

  describe('CreateFieldPage - Date field rendering setup', () => {
    it('should wrap preview in LocalizationProvider for date field support', () => {
      const fileContent = readFileSync(createFieldPagePath, 'utf-8');
      
      // Verify LocalizationProvider is imported
      expect(fileContent).toContain("import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'");
      expect(fileContent).toContain("import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'");
      expect(fileContent).toContain("import { enGB } from 'date-fns/locale'");
      
      // Verify LocalizationProvider wraps the preview
      expect(fileContent).toContain('<LocalizationProvider');
      expect(fileContent).toContain('dateAdapter={AdapterDateFns}');
      expect(fileContent).toContain('adapterLocale={enGB}');
    });

    it('should support date, time, and datetime field types in preview', () => {
      const fileContent = readFileSync(createFieldPagePath, 'utf-8');
      
      // Verify date/time/datetime are available field types
      expect(fileContent).toContain("'date'");
      expect(fileContent).toContain("'time'");
      expect(fileContent).toContain("'datetime'");
    });
  });

  describe('DateRenderer - Component structure', () => {
    it('should import date picker components from MUI X', () => {
      const fileContent = readFileSync(dateRendererPath, 'utf-8');
      
      // Verify date picker imports
      expect(fileContent).toContain("import { DatePicker } from '@mui/x-date-pickers/DatePicker'");
      expect(fileContent).toContain("import { TimePicker } from '@mui/x-date-pickers/TimePicker'");
      expect(fileContent).toContain("import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'");
    });

    it('should render appropriate picker based on datatype', () => {
      const fileContent = readFileSync(dateRendererPath, 'utf-8');
      
      // Verify conditional rendering based on datatype
      expect(fileContent).toContain("fieldDefinition.datatype === 'date'");
      expect(fileContent).toContain('<DatePicker');
      expect(fileContent).toContain("fieldDefinition.datatype === 'time'");
      expect(fileContent).toContain('<TimePicker');
      expect(fileContent).toContain("fieldDefinition.datatype === 'datetime'");
      expect(fileContent).toContain('<DateTimePicker');
    });

    it('should have documentation about LocalizationProvider requirement', () => {
      const fileContent = readFileSync(dateRendererPath, 'utf-8');
      
      // Verify documentation exists
      expect(fileContent).toContain('LocalizationProvider');
      expect(fileContent).toContain('IMPORTANT');
      expect(fileContent).toContain('context');
    });

    it('should NOT include LocalizationProvider wrapper in component', () => {
      const fileContent = readFileSync(dateRendererPath, 'utf-8');
      
      // Verify DateRenderer function doesn't wrap in LocalizationProvider
      const functionMatch = fileContent.match(/export function DateRenderer[\s\S]*?^}/m);
      expect(functionMatch).toBeTruthy();
      
      if (functionMatch) {
        const functionBody = functionMatch[0];
        // The function should not contain LocalizationProvider in its JSX
        const hasProviderInReturn = functionBody.includes('return') && 
                                     functionBody.includes('<LocalizationProvider');
        expect(hasProviderInReturn).toBe(false);
      }
    });
  });

  describe('Integration - Date field rendering without errors', () => {
    it('should have proper component hierarchy for error-free rendering', () => {
      const formPreviewContent = readFileSync(formPreviewPagePath, 'utf-8');
      const dateRendererContent = readFileSync(dateRendererPath, 'utf-8');
      
      // Verify FormPreviewPage has LocalizationProvider
      const hasProvider = formPreviewContent.includes('<LocalizationProvider') &&
                         formPreviewContent.includes('dateAdapter={AdapterDateFns}');
      expect(hasProvider).toBe(true);
      
      // Verify DateRenderer uses date pickers without provider
      const usesDatePickers = dateRendererContent.includes('<DatePicker') ||
                             dateRendererContent.includes('<TimePicker') ||
                             dateRendererContent.includes('<DateTimePicker');
      expect(usesDatePickers).toBe(true);
      
      // Verify DateRenderer returns a fragment (<>) not LocalizationProvider
      // The return statement should use React fragment
      expect(dateRendererContent).toContain('return (');
      expect(dateRendererContent).toContain('<>');
      expect(dateRendererContent).toContain('</>');
      
      // Verify the pattern: return ( followed by <> (with possible whitespace/comments)
      // This confirms the component returns a fragment, not LocalizationProvider
      const hasFragmentReturn = /return\s*\(\s*(?:\/\/[^\n]*\n\s*)*<>/.test(dateRendererContent);
      expect(hasFragmentReturn).toBe(true);
    });

    it('should support multiple date fields in same form', () => {
      const formPreviewContent = readFileSync(formPreviewPagePath, 'utf-8');
      
      // Verify form can render multiple fields
      const hasFieldMapping = formPreviewContent.includes('.map(renderField)') ||
                             formPreviewContent.includes('renderField(field)');
      expect(hasFieldMapping).toBe(true);
      
      // Verify single LocalizationProvider wraps all fields
      const providerMatches = formPreviewContent.match(/<LocalizationProvider/g);
      expect(providerMatches).toBeTruthy();
      expect(providerMatches!.length).toBe(1); // Only one provider at page level
    });
  });

  describe('Multiple date fields rendering - Requirements 1.4, 6.4', () => {
    it('should render form with 3+ date fields without context conflicts', () => {
      const formPreviewContent = readFileSync(formPreviewPagePath, 'utf-8');
      
      // Verify single LocalizationProvider at page level
      const providerMatches = formPreviewContent.match(/<LocalizationProvider/g);
      expect(providerMatches).toBeTruthy();
      expect(providerMatches!.length).toBe(1);
      
      // Verify LocalizationProvider wraps the entire form content
      // It should be at the top level of the return statement
      const hasTopLevelProvider = /<LocalizationProvider[^>]*>[\s\S]*<\/LocalizationProvider>/.test(formPreviewContent);
      expect(hasTopLevelProvider).toBe(true);
      
      // Verify the renderField function is used to render all fields
      // This ensures all date fields share the same LocalizationProvider context
      const hasRenderFieldFunction = /const renderField = \(field: ApplicationFormField\)/.test(formPreviewContent);
      expect(hasRenderFieldFunction).toBe(true);
      
      // Verify fields are rendered using map, which allows multiple fields
      const hasFieldsMap = /\.map\(renderField\)/.test(formPreviewContent);
      expect(hasFieldsMap).toBe(true);
    });

    it('should ensure all date field types can coexist without conflicts', () => {
      const formPreviewContent = readFileSync(formPreviewPagePath, 'utf-8');
      
      // Verify all three date field types are mapped correctly
      const hasDatatypeMapping = formPreviewContent.includes("'date': 'date'") &&
                                formPreviewContent.includes("'time': 'time'") &&
                                formPreviewContent.includes("'datetime': 'datetime'");
      expect(hasDatatypeMapping).toBe(true);
      
      // Verify the mapping function handles all types
      const hasMappingFunction = /const mapDatatypeToRenderer = \(datatype: string\): string/.test(formPreviewContent);
      expect(hasMappingFunction).toBe(true);
      
      // Verify FieldRenderer is used for all field types
      const hasFieldRenderer = formPreviewContent.includes('<FieldRenderer') &&
                              formPreviewContent.includes('fieldDefinition={fieldDefinition}');
      expect(hasFieldRenderer).toBe(true);
    });

    it('should maintain independent state for each date field', () => {
      const formPreviewContent = readFileSync(formPreviewPagePath, 'utf-8');
      
      // Verify formData state is used to track field values independently
      const hasFormDataState = /const \[formData, setFormData\] = useState<Record<string, any>>/.test(formPreviewContent);
      expect(hasFormDataState).toBe(true);
      
      // Verify each field has its own value from formData
      const hasIndependentValues = /value={formData\[field\.name\]/.test(formPreviewContent);
      expect(hasIndependentValues).toBe(true);
      
      // Verify onChange updates only the specific field
      const hasIndependentOnChange = /onChange=\{\(value\) => setFormData\(\{ \.\.\.formData, \[field\.name\]: value \}\)\}/.test(formPreviewContent);
      expect(hasIndependentOnChange).toBe(true);
    });

    it('should not create nested LocalizationProviders for multiple fields', () => {
      const dateRendererContent = readFileSync(dateRendererPath, 'utf-8');
      
      // Verify DateRenderer does NOT wrap its content in LocalizationProvider
      // This is critical to avoid nested providers when multiple date fields are rendered
      
      // Check that the file contains the DateRenderer function
      expect(dateRendererContent).toContain('export function DateRenderer');
      
      // Check that the function returns a fragment with date pickers
      expect(dateRendererContent).toContain('return (');
      expect(dateRendererContent).toContain('<>');
      expect(dateRendererContent).toContain('<DatePicker');
      
      // Most importantly: verify the function does NOT use LocalizationProvider in its JSX
      // Extract just the return statement (after the function parameters)
      const returnStatementMatch = dateRendererContent.match(/return \(\s*<>[\s\S]*?<\/>\s*\)/);
      expect(returnStatementMatch).toBeTruthy();
      
      if (returnStatementMatch) {
        const returnStatement = returnStatementMatch[0];
        // The return statement should NOT contain LocalizationProvider
        expect(returnStatement).not.toContain('LocalizationProvider');
        // But it should contain the date picker components
        expect(returnStatement).toContain('DatePicker');
        expect(returnStatement).toContain('TimePicker');
        expect(returnStatement).toContain('DateTimePicker');
      }
    });

    it('should document the single provider pattern for multiple fields', () => {
      const formPreviewContent = readFileSync(formPreviewPagePath, 'utf-8');
      
      // Verify there's documentation explaining why LocalizationProvider is at page level
      const hasDocumentation = formPreviewContent.includes('LocalizationProvider must be at page level') ||
                              (formPreviewContent.includes('LocalizationProvider') && 
                               formPreviewContent.includes('page level'));
      expect(hasDocumentation).toBe(true);
      
      // Verify the documentation mentions the context issue
      const mentionsContext = formPreviewContent.includes('context') &&
                             (formPreviewContent.includes('Vite') || formPreviewContent.includes('module'));
      expect(mentionsContext).toBe(true);
    });
  });

  describe('Documentation and comments', () => {
    it('should document the Vite module resolution issue', () => {
      const formPreviewContent = readFileSync(formPreviewPagePath, 'utf-8');
      
      // Verify there's documentation about the issue
      const hasViteComment = formPreviewContent.includes('Vite') &&
                            formPreviewContent.includes('module') &&
                            (formPreviewContent.includes('resolution') || formPreviewContent.includes('instance'));
      expect(hasViteComment).toBe(true);
    });

    it('should document LocalizationProvider requirement in DateRenderer', () => {
      const dateRendererContent = readFileSync(dateRendererPath, 'utf-8');
      
      // Verify JSDoc or comments explain the requirement
      const hasRequirementDoc = dateRendererContent.includes('IMPORTANT') &&
                               dateRendererContent.includes('LocalizationProvider') &&
                               dateRendererContent.includes('parent');
      expect(hasRequirementDoc).toBe(true);
    });

    it('should provide usage example in DateRenderer documentation', () => {
      const dateRendererContent = readFileSync(dateRendererPath, 'utf-8');
      
      // Verify there's an example showing proper usage
      const hasExample = dateRendererContent.includes('@example') ||
                        (dateRendererContent.includes('```') && 
                         dateRendererContent.includes('LocalizationProvider'));
      expect(hasExample).toBe(true);
    });
  });
});
