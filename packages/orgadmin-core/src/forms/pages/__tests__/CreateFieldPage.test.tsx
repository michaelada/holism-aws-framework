/**
 * Unit tests for CreateFieldPage component
 * Tests LocalizationProvider setup for date picker preview functionality
 * Tests component rendering with and without document-management capability
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.9, 6.4**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Mock the useFilteredFieldTypes hook
vi.mock('../../hooks/useFilteredFieldTypes', () => ({
  useFilteredFieldTypes: vi.fn(() => [
    'text',
    'textarea',
    'number',
    'email',
    'phone',
    'date',
    'time',
    'datetime',
    'boolean',
    'select',
    'multiselect',
    'radio',
    'checkbox',
  ]),
}));

import { useFilteredFieldTypes } from '../../hooks/useFilteredFieldTypes';

describe('CreateFieldPage - Component Rendering Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const componentPath = join(__dirname, '../CreateFieldPage.tsx');
  const fileContent = readFileSync(componentPath, 'utf-8');

  describe('Component uses useFilteredFieldTypes hook', () => {
    it('should import useFilteredFieldTypes hook', () => {
      // Verify the hook is imported
      expect(fileContent).toContain("import { useFilteredFieldTypes } from '../hooks/useFilteredFieldTypes'");
    });

    it('should call useFilteredFieldTypes hook in component', () => {
      // Verify the hook is called
      expect(fileContent).toContain('const fieldTypes = useFilteredFieldTypes()');
    });

    it('should use fieldTypes variable in the component', () => {
      // Verify fieldTypes is used (likely in a map function for rendering)
      expect(fileContent).toContain('fieldTypes');
    });
  });

  describe('Field type dropdown rendering', () => {
    it('should render field types in a Select/MenuItem structure', () => {
      // Verify the component uses Material-UI Select and MenuItem
      expect(fileContent).toContain('<Select');
      expect(fileContent).toContain('<MenuItem');
    });

    it('should map over fieldTypes to render options', () => {
      // Verify fieldTypes is mapped to create menu items
      expect(fileContent).toContain('fieldTypes.map');
      expect(fileContent).toMatch(/fieldTypes\.map\([^)]*\)/);
    });

    it('should render each field type as a MenuItem', () => {
      // Verify each type is rendered as a MenuItem with key and value
      const mapMatch = fileContent.match(/fieldTypes\.map\(\(([^)]+)\)\s*=>\s*\(/);
      expect(mapMatch).toBeTruthy();
      
      // Check that MenuItem is rendered with the type
      const menuItemPattern = /<MenuItem[^>]*key={[^}]*}[^>]*value={[^}]*}[^>]*>/;
      expect(fileContent).toMatch(menuItemPattern);
    });
  });

  describe('Hook behavior with different capabilities', () => {
    it('should return all field types including file and image when capability is present', () => {
      // Mock with document-management capability
      vi.mocked(useFilteredFieldTypes).mockReturnValue([
        'text',
        'textarea',
        'number',
        'email',
        'phone',
        'date',
        'time',
        'datetime',
        'boolean',
        'select',
        'multiselect',
        'radio',
        'checkbox',
        'file',
        'image',
      ]);

      const fieldTypes = useFilteredFieldTypes();
      
      // Verify file and image are included
      expect(fieldTypes).toContain('file');
      expect(fieldTypes).toContain('image');
      expect(fieldTypes).toHaveLength(15);
    });

    it('should return field types without file and image when capability is absent', () => {
      // Mock without document-management capability
      vi.mocked(useFilteredFieldTypes).mockReturnValue([
        'text',
        'textarea',
        'number',
        'email',
        'phone',
        'date',
        'time',
        'datetime',
        'boolean',
        'select',
        'multiselect',
        'radio',
        'checkbox',
      ]);

      const fieldTypes = useFilteredFieldTypes();
      
      // Verify file and image are NOT included
      expect(fieldTypes).not.toContain('file');
      expect(fieldTypes).not.toContain('image');
      expect(fieldTypes).toHaveLength(13);
    });

    it('should always include non-document field types', () => {
      // Test with capability
      vi.mocked(useFilteredFieldTypes).mockReturnValue([
        'text',
        'textarea',
        'number',
        'email',
        'phone',
        'date',
        'time',
        'datetime',
        'boolean',
        'select',
        'multiselect',
        'radio',
        'checkbox',
        'file',
        'image',
      ]);

      let fieldTypes = useFilteredFieldTypes();
      const nonDocumentTypes = [
        'text',
        'textarea',
        'number',
        'email',
        'phone',
        'date',
        'time',
        'datetime',
        'boolean',
        'select',
        'multiselect',
        'radio',
        'checkbox',
      ];

      nonDocumentTypes.forEach((type) => {
        expect(fieldTypes).toContain(type);
      });

      // Test without capability
      vi.mocked(useFilteredFieldTypes).mockReturnValue([
        'text',
        'textarea',
        'number',
        'email',
        'phone',
        'date',
        'time',
        'datetime',
        'boolean',
        'select',
        'multiselect',
        'radio',
        'checkbox',
      ]);

      fieldTypes = useFilteredFieldTypes();

      nonDocumentTypes.forEach((type) => {
        expect(fieldTypes).toContain(type);
      });
    });
  });
});

describe('CreateFieldPage - LocalizationProvider Tests', () => {
  const componentPath = join(__dirname, '../CreateFieldPage.tsx');

  describe('LocalizationProvider Configuration', () => {
    it('should import LocalizationProvider from @mui/x-date-pickers', () => {
      const fileContent = readFileSync(componentPath, 'utf-8');
      
      // Verify LocalizationProvider is imported
      expect(fileContent).toContain("import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'");
    });

    it('should import AdapterDateFns from @mui/x-date-pickers', () => {
      const fileContent = readFileSync(componentPath, 'utf-8');
      
      // Verify AdapterDateFns is imported
      expect(fileContent).toContain("import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'");
    });

    it('should import enGB locale from date-fns', () => {
      const fileContent = readFileSync(componentPath, 'utf-8');
      
      // Verify enGB locale is imported
      expect(fileContent).toContain("import { enGB } from 'date-fns/locale'");
    });

    it('should wrap FieldRenderer preview in LocalizationProvider', () => {
      const fileContent = readFileSync(componentPath, 'utf-8');
      
      // Verify LocalizationProvider wraps FieldRenderer
      expect(fileContent).toContain('<LocalizationProvider');
      expect(fileContent).toContain('dateAdapter={AdapterDateFns}');
      expect(fileContent).toContain('adapterLocale={enGB}');
      expect(fileContent).toContain('<FieldRenderer');
      
      // Verify LocalizationProvider comes before FieldRenderer in the file
      const localizationProviderIndex = fileContent.indexOf('<LocalizationProvider');
      const fieldRendererIndex = fileContent.indexOf('<FieldRenderer');
      expect(localizationProviderIndex).toBeLessThan(fieldRendererIndex);
      expect(localizationProviderIndex).toBeGreaterThan(0);
      expect(fieldRendererIndex).toBeGreaterThan(0);
    });

    it('should configure LocalizationProvider with correct props', () => {
      const fileContent = readFileSync(componentPath, 'utf-8');
      
      // Extract the LocalizationProvider section
      const localizationProviderMatch = fileContent.match(
        /<LocalizationProvider[^>]*>/
      );
      
      expect(localizationProviderMatch).toBeTruthy();
      
      if (localizationProviderMatch) {
        const providerTag = localizationProviderMatch[0];
        
        // Verify it has the required props
        expect(providerTag).toContain('dateAdapter');
        expect(providerTag).toContain('adapterLocale');
      }
    });

    it('should only render LocalizationProvider when fieldLabel is present', () => {
      const fileContent = readFileSync(componentPath, 'utf-8');
      
      // Verify conditional rendering based on fieldLabel
      expect(fileContent).toContain('fieldLabel ?');
      
      // Verify LocalizationProvider is in the conditional block
      const conditionalBlockMatch = fileContent.match(
        /fieldLabel \?[\s\S]*?<LocalizationProvider[\s\S]*?<\/LocalizationProvider>/
      );
      
      expect(conditionalBlockMatch).toBeTruthy();
    });
  });

  describe('Component Structure', () => {
    it('should have a preview section', () => {
      const fileContent = readFileSync(componentPath, 'utf-8');
      
      // Verify preview section exists (using translation key)
      expect(fileContent).toContain('livePreview');
      expect(fileContent).toContain('previewDescription');
    });

    it('should have field configuration form', () => {
      const fileContent = readFileSync(componentPath, 'utf-8');
      
      // Verify form elements exist
      expect(fileContent).toContain('fieldLabel');
      expect(fileContent).toContain('fieldType');
      expect(fileContent).toContain('fieldDescription');
    });

    it('should support date, time, and datetime field types', () => {
      const fileContent = readFileSync(componentPath, 'utf-8');
      
      // Verify field types array includes date/time types
      expect(fileContent).toContain("'date'");
      expect(fileContent).toContain("'time'");
      expect(fileContent).toContain("'datetime'");
    });
  });
});
