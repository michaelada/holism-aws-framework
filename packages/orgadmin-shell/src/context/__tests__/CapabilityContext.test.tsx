import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CapabilityProvider, useCapabilities } from '../CapabilityContext';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Test component that uses the hook
const TestComponent = () => {
  const { capabilities, loading, error, hasCapability } = useCapabilities();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <div data-testid="capabilities">{capabilities.join(', ')}</div>
      <div data-testid="has-events">{hasCapability('event-management').toString()}</div>
      <div data-testid="has-members">{hasCapability('memberships').toString()}</div>
      <div data-testid="has-merchandise">{hasCapability('merchandise').toString()}</div>
    </div>
  );
};

describe('CapabilityContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CapabilityProvider', () => {
    it('should provide capabilities when passed directly', () => {
      const capabilities = ['event-management', 'memberships'];

      render(
        <CapabilityProvider capabilities={capabilities}>
          <TestComponent />
        </CapabilityProvider>
      );

      expect(screen.getByTestId('capabilities')).toHaveTextContent('event-management, memberships');
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    it('should fetch capabilities from API when not provided', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          capabilities: ['event-management', 'memberships', 'merchandise'],
        },
      });

      render(
        <CapabilityProvider>
          <TestComponent />
        </CapabilityProvider>
      );

      // Should show loading initially
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // Wait for capabilities to load
      await waitFor(() => {
        expect(screen.getByTestId('capabilities')).toHaveTextContent(
          'event-management, memberships, merchandise'
        );
      });

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/orgadmin/auth/capabilities', {
        baseURL: import.meta.env.VITE_API_BASE_URL,
        withCredentials: true,
      });
    });

    it('should handle API errors gracefully', async () => {
      const errorMessage = 'Network error';
      mockedAxios.get.mockRejectedValueOnce(new Error(errorMessage));

      render(
        <CapabilityProvider>
          <TestComponent />
        </CapabilityProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(`Error: ${errorMessage}`)).toBeInTheDocument();
      });
    });

    it('should handle empty capabilities response', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {},
      });

      render(
        <CapabilityProvider>
          <TestComponent />
        </CapabilityProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('capabilities')).toHaveTextContent('');
      });
    });
  });

  describe('hasCapability', () => {
    it('should return true for enabled capabilities', () => {
      const capabilities = ['event-management', 'memberships'];

      render(
        <CapabilityProvider capabilities={capabilities}>
          <TestComponent />
        </CapabilityProvider>
      );

      expect(screen.getByTestId('has-events')).toHaveTextContent('true');
      expect(screen.getByTestId('has-members')).toHaveTextContent('true');
    });

    it('should return false for disabled capabilities', () => {
      const capabilities = ['event-management'];

      render(
        <CapabilityProvider capabilities={capabilities}>
          <TestComponent />
        </CapabilityProvider>
      );

      expect(screen.getByTestId('has-events')).toHaveTextContent('true');
      expect(screen.getByTestId('has-merchandise')).toHaveTextContent('false');
    });

    it('should return false for non-existent capabilities', () => {
      const capabilities = ['event-management'];

      render(
        <CapabilityProvider capabilities={capabilities}>
          <TestComponent />
        </CapabilityProvider>
      );

      expect(screen.getByTestId('has-merchandise')).toHaveTextContent('false');
    });

    it('should filter capabilities correctly with multiple enabled', () => {
      const capabilities = ['event-management', 'memberships', 'merchandise', 'calendar-bookings'];

      render(
        <CapabilityProvider capabilities={capabilities}>
          <TestComponent />
        </CapabilityProvider>
      );

      expect(screen.getByTestId('has-events')).toHaveTextContent('true');
      expect(screen.getByTestId('has-members')).toHaveTextContent('true');
      expect(screen.getByTestId('has-merchandise')).toHaveTextContent('true');
    });
  });

  describe('useCapabilities hook', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const TestComponentWithoutProvider = () => {
        useCapabilities();
        return null;
      };

      expect(() => {
        render(<TestComponentWithoutProvider />);
      }).toThrow('useCapabilities must be used within a CapabilityProvider');

      consoleError.mockRestore();
    });

    it('should provide all context values', () => {
      const capabilities = ['event-management'];
      
      const TestComponentWithAllValues = () => {
        const context = useCapabilities();
        
        return (
          <div>
            <div data-testid="capabilities-length">{context.capabilities.length}</div>
            <div data-testid="loading">{context.loading.toString()}</div>
            <div data-testid="error">{context.error || 'null'}</div>
            <div data-testid="has-capability-fn">{typeof context.hasCapability}</div>
            <div data-testid="refetch-fn">{typeof context.refetch}</div>
          </div>
        );
      };

      render(
        <CapabilityProvider capabilities={capabilities}>
          <TestComponentWithAllValues />
        </CapabilityProvider>
      );

      expect(screen.getByTestId('capabilities-length')).toHaveTextContent('1');
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('error')).toHaveTextContent('null');
      expect(screen.getByTestId('has-capability-fn')).toHaveTextContent('function');
      expect(screen.getByTestId('refetch-fn')).toHaveTextContent('function');
    });
  });

  describe('refetch functionality', () => {
    it('should refetch capabilities when refetch is called', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          data: { capabilities: ['event-management'] },
        })
        .mockResolvedValueOnce({
          data: { capabilities: ['event-management', 'memberships'] },
        });

      const TestComponentWithRefetch = () => {
        const { capabilities, refetch, loading } = useCapabilities();

        return (
          <div>
            {loading ? (
              <div>Loading...</div>
            ) : (
              <>
                <div data-testid="capabilities">{capabilities.join(', ')}</div>
                <button onClick={() => refetch()}>Refetch</button>
              </>
            )}
          </div>
        );
      };

      render(
        <CapabilityProvider>
          <TestComponentWithRefetch />
        </CapabilityProvider>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('capabilities')).toHaveTextContent('event-management');
      });

      // Click refetch button
      const refetchButton = screen.getByText('Refetch');
      refetchButton.click();

      // Wait for refetch to complete
      await waitFor(() => {
        expect(screen.getByTestId('capabilities')).toHaveTextContent('event-management, memberships');
      });

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
  });
});
