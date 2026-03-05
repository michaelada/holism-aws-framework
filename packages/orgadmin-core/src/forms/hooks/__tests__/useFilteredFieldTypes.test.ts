/**
 * Unit Tests for useFilteredFieldTypes Hook
 * 
 * Tests the useFilteredFieldTypes hook to verify:
 * 1. When document-management capability is present, returns all field types including 'file' and 'image'
 * 2. When document-management capability is absent, returns all field types except 'file' and 'image'
 * 3. Non-document field types are always included regardless of capabilities
 * 4. The hook correctly uses the useCapabilities hook
 * 
 * **Validates: Requirements 3.1-3.10**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFilteredFieldTypes } from '../useFilteredFieldTypes';

// Mock the dependencies
vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useCapabilities: vi.fn(),
}));

import { useCapabilities } from '@aws-web-framework/orgadmin-shell';

describe('useFilteredFieldTypes Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Non-document field types that should always be visible
  const nonDocumentFieldTypes = [
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

  // Document field types that require capability
  const documentFieldTypes = ['file', 'image'];

  describe('with document-management capability present', () => {
    it('should return all field types including file and image', () => {
      // Mock the capabilities hook with document-management capability
      vi.mocked(useCapabilities).mockReturnValue({
        capabilities: ['document-management'],
        loading: false,
        error: null,
        hasCapability: (cap: string) => cap === 'document-management',
        refetch: vi.fn(),
      });

      // Render the hook
      const { result } = renderHook(() => useFilteredFieldTypes());

      // Verify all field types are present
      expect(result.current).toContain('file');
      expect(result.current).toContain('image');
      
      // Verify non-document types are also present
      nonDocumentFieldTypes.forEach(type => {
        expect(result.current).toContain(type);
      });

      // Verify total count (13 non-document + 2 document = 15)
      expect(result.current).toHaveLength(15);
    });

    it('should include file type when document-management capability is present', () => {
      vi.mocked(useCapabilities).mockReturnValue({
        capabilities: ['document-management', 'other-capability'],
        loading: false,
        error: null,
        hasCapability: (cap: string) => ['document-management', 'other-capability'].includes(cap),
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useFilteredFieldTypes());

      expect(result.current).toContain('file');
    });

    it('should include image type when document-management capability is present', () => {
      vi.mocked(useCapabilities).mockReturnValue({
        capabilities: ['document-management', 'another-capability'],
        loading: false,
        error: null,
        hasCapability: (cap: string) => ['document-management', 'another-capability'].includes(cap),
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useFilteredFieldTypes());

      expect(result.current).toContain('image');
    });
  });

  describe('with document-management capability absent', () => {
    it('should return all field types except file and image', () => {
      // Mock the capabilities hook without document-management capability
      vi.mocked(useCapabilities).mockReturnValue({
        capabilities: ['some-other-capability'],
        loading: false,
        error: null,
        hasCapability: (cap: string) => cap === 'some-other-capability',
        refetch: vi.fn(),
      });

      // Render the hook
      const { result } = renderHook(() => useFilteredFieldTypes());

      // Verify document types are NOT present
      expect(result.current).not.toContain('file');
      expect(result.current).not.toContain('image');
      
      // Verify non-document types are present
      nonDocumentFieldTypes.forEach(type => {
        expect(result.current).toContain(type);
      });

      // Verify total count (13 non-document types only)
      expect(result.current).toHaveLength(13);
    });

    it('should exclude file type when document-management capability is absent', () => {
      vi.mocked(useCapabilities).mockReturnValue({
        capabilities: [],
        loading: false,
        error: null,
        hasCapability: () => false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useFilteredFieldTypes());

      expect(result.current).not.toContain('file');
    });

    it('should exclude image type when document-management capability is absent', () => {
      vi.mocked(useCapabilities).mockReturnValue({
        capabilities: ['unrelated-capability'],
        loading: false,
        error: null,
        hasCapability: (cap: string) => cap === 'unrelated-capability',
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useFilteredFieldTypes());

      expect(result.current).not.toContain('image');
    });
  });

  describe('non-document field types', () => {
    it('should always include all non-document field types regardless of capabilities', () => {
      // Test with no capabilities
      vi.mocked(useCapabilities).mockReturnValue({
        capabilities: [],
        loading: false,
        error: null,
        hasCapability: () => false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useFilteredFieldTypes());

      // Verify all non-document types are present
      nonDocumentFieldTypes.forEach(type => {
        expect(result.current).toContain(type);
      });
    });

    it('should include text field type regardless of capabilities', () => {
      vi.mocked(useCapabilities).mockReturnValue({
        capabilities: [],
        loading: false,
        error: null,
        hasCapability: () => false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useFilteredFieldTypes());

      expect(result.current).toContain('text');
    });

    it('should include number field type regardless of capabilities', () => {
      vi.mocked(useCapabilities).mockReturnValue({
        capabilities: [],
        loading: false,
        error: null,
        hasCapability: () => false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useFilteredFieldTypes());

      expect(result.current).toContain('number');
    });

    it('should include date field type regardless of capabilities', () => {
      vi.mocked(useCapabilities).mockReturnValue({
        capabilities: [],
        loading: false,
        error: null,
        hasCapability: () => false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useFilteredFieldTypes());

      expect(result.current).toContain('date');
    });

    it('should include select field type regardless of capabilities', () => {
      vi.mocked(useCapabilities).mockReturnValue({
        capabilities: [],
        loading: false,
        error: null,
        hasCapability: () => false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useFilteredFieldTypes());

      expect(result.current).toContain('select');
    });
  });

  describe('useCapabilities hook integration', () => {
    it('should call hasCapability with document-management for file type', () => {
      const hasCapabilityMock = vi.fn(() => true);
      
      vi.mocked(useCapabilities).mockReturnValue({
        capabilities: ['document-management'],
        loading: false,
        error: null,
        hasCapability: hasCapabilityMock,
        refetch: vi.fn(),
      });

      renderHook(() => useFilteredFieldTypes());

      // The hook should call hasCapability for document types
      expect(hasCapabilityMock).toHaveBeenCalledWith('document-management');
    });

    it('should correctly use hasCapability return value', () => {
      const hasCapabilityMock = vi.fn((cap: string) => cap === 'document-management');
      
      vi.mocked(useCapabilities).mockReturnValue({
        capabilities: ['document-management'],
        loading: false,
        error: null,
        hasCapability: hasCapabilityMock,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useFilteredFieldTypes());

      // Should include document types when hasCapability returns true
      expect(result.current).toContain('file');
      expect(result.current).toContain('image');
    });

    it('should handle empty capabilities array', () => {
      vi.mocked(useCapabilities).mockReturnValue({
        capabilities: [],
        loading: false,
        error: null,
        hasCapability: () => false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useFilteredFieldTypes());

      // Should not include document types
      expect(result.current).not.toContain('file');
      expect(result.current).not.toContain('image');
      
      // Should still include non-document types
      expect(result.current.length).toBeGreaterThan(0);
      expect(result.current).toContain('text');
    });
  });
});
