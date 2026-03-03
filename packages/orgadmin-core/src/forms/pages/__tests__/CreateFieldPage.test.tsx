/**
 * Unit tests for CreateFieldPage component
 * Tests LocalizationProvider setup for date picker preview functionality
 * 
 * **Validates: Requirements 6.4**
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

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
