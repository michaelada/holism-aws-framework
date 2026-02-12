import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrganisationProvider, useOrganisation, Organisation } from '../OrganisationContext';

// Test component that uses the hook
const TestComponent = () => {
  const { organisation } = useOrganisation();

  return (
    <div>
      <div data-testid="org-id">{organisation.id}</div>
      <div data-testid="org-name">{organisation.name}</div>
      <div data-testid="org-display-name">{organisation.displayName}</div>
      <div data-testid="org-status">{organisation.status}</div>
      <div data-testid="org-currency">{organisation.currency || 'none'}</div>
      <div data-testid="org-language">{organisation.language || 'none'}</div>
      <div data-testid="org-capabilities">{organisation.enabledCapabilities.join(', ')}</div>
    </div>
  );
};

describe('OrganisationContext', () => {
  const mockOrganisation: Organisation = {
    id: 'org-123',
    organizationTypeId: 'type-456',
    keycloakGroupId: 'group-789',
    name: 'test-org',
    displayName: 'Test Organisation',
    domain: 'test.example.com',
    status: 'active',
    currency: 'USD',
    language: 'en',
    enabledCapabilities: ['event-management', 'memberships'],
    settings: { theme: 'light' },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  };

  describe('OrganisationProvider', () => {
    it('should provide organisation data to children', () => {
      render(
        <OrganisationProvider organisation={mockOrganisation}>
          <TestComponent />
        </OrganisationProvider>
      );

      expect(screen.getByTestId('org-id')).toHaveTextContent('org-123');
      expect(screen.getByTestId('org-name')).toHaveTextContent('test-org');
      expect(screen.getByTestId('org-display-name')).toHaveTextContent('Test Organisation');
      expect(screen.getByTestId('org-status')).toHaveTextContent('active');
    });

    it('should provide organisation currency and language', () => {
      render(
        <OrganisationProvider organisation={mockOrganisation}>
          <TestComponent />
        </OrganisationProvider>
      );

      expect(screen.getByTestId('org-currency')).toHaveTextContent('USD');
      expect(screen.getByTestId('org-language')).toHaveTextContent('en');
    });

    it('should provide enabled capabilities', () => {
      render(
        <OrganisationProvider organisation={mockOrganisation}>
          <TestComponent />
        </OrganisationProvider>
      );

      expect(screen.getByTestId('org-capabilities')).toHaveTextContent('event-management, memberships');
    });

    it('should handle organisation without optional fields', () => {
      const minimalOrg: Organisation = {
        id: 'org-minimal',
        organizationTypeId: 'type-1',
        keycloakGroupId: 'group-1',
        name: 'minimal-org',
        displayName: 'Minimal Org',
        status: 'active',
        enabledCapabilities: [],
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      render(
        <OrganisationProvider organisation={minimalOrg}>
          <TestComponent />
        </OrganisationProvider>
      );

      expect(screen.getByTestId('org-id')).toHaveTextContent('org-minimal');
      expect(screen.getByTestId('org-currency')).toHaveTextContent('none');
      expect(screen.getByTestId('org-language')).toHaveTextContent('none');
      expect(screen.getByTestId('org-capabilities')).toHaveTextContent('');
    });

    it('should handle different organisation statuses', () => {
      const inactiveOrg: Organisation = {
        ...mockOrganisation,
        status: 'inactive',
      };

      render(
        <OrganisationProvider organisation={inactiveOrg}>
          <TestComponent />
        </OrganisationProvider>
      );

      expect(screen.getByTestId('org-status')).toHaveTextContent('inactive');
    });

    it('should handle blocked organisation status', () => {
      const blockedOrg: Organisation = {
        ...mockOrganisation,
        status: 'blocked',
      };

      render(
        <OrganisationProvider organisation={blockedOrg}>
          <TestComponent />
        </OrganisationProvider>
      );

      expect(screen.getByTestId('org-status')).toHaveTextContent('blocked');
    });

    it('should provide organisation with multiple capabilities', () => {
      const orgWithManyCapabilities: Organisation = {
        ...mockOrganisation,
        enabledCapabilities: [
          'event-management',
          'memberships',
          'merchandise',
          'calendar-bookings',
          'registrations',
          'event-ticketing',
        ],
      };

      render(
        <OrganisationProvider organisation={orgWithManyCapabilities}>
          <TestComponent />
        </OrganisationProvider>
      );

      expect(screen.getByTestId('org-capabilities')).toHaveTextContent(
        'event-management, memberships, merchandise, calendar-bookings, registrations, event-ticketing'
      );
    });

    it('should provide organisation settings', () => {
      const TestComponentWithSettings = () => {
        const { organisation } = useOrganisation();
        return (
          <div data-testid="org-settings">{JSON.stringify(organisation.settings)}</div>
        );
      };

      render(
        <OrganisationProvider organisation={mockOrganisation}>
          <TestComponentWithSettings />
        </OrganisationProvider>
      );

      expect(screen.getByTestId('org-settings')).toHaveTextContent('{"theme":"light"}');
    });
  });

  describe('useOrganisation hook', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const TestComponentWithoutProvider = () => {
        useOrganisation();
        return null;
      };

      expect(() => {
        render(<TestComponentWithoutProvider />);
      }).toThrow('useOrganisation must be used within an OrganisationProvider');

      consoleError.mockRestore();
    });

    it('should provide organisation context value', () => {
      const TestComponentWithContext = () => {
        const context = useOrganisation();
        
        return (
          <div>
            <div data-testid="has-organisation">{context.organisation ? 'yes' : 'no'}</div>
            <div data-testid="context-type">{typeof context}</div>
          </div>
        );
      };

      render(
        <OrganisationProvider organisation={mockOrganisation}>
          <TestComponentWithContext />
        </OrganisationProvider>
      );

      expect(screen.getByTestId('has-organisation')).toHaveTextContent('yes');
      expect(screen.getByTestId('context-type')).toHaveTextContent('object');
    });
  });

  describe('Organisation data immutability', () => {
    it('should provide the same organisation reference', () => {
      let firstRender: Organisation | null = null;
      let secondRender: Organisation | null = null;

      const TestComponentWithRef = ({ renderCount }: { renderCount: number }) => {
        const { organisation } = useOrganisation();
        
        if (renderCount === 1) {
          firstRender = organisation;
        } else {
          secondRender = organisation;
        }

        return <div data-testid="render-count">{renderCount}</div>;
      };

      const { rerender } = render(
        <OrganisationProvider organisation={mockOrganisation}>
          <TestComponentWithRef renderCount={1} />
        </OrganisationProvider>
      );

      rerender(
        <OrganisationProvider organisation={mockOrganisation}>
          <TestComponentWithRef renderCount={2} />
        </OrganisationProvider>
      );

      expect(firstRender).toBe(secondRender);
    });
  });

  describe('Multiple consumers', () => {
    it('should provide same organisation data to multiple consumers', () => {
      const Consumer1 = () => {
        const { organisation } = useOrganisation();
        return <div data-testid="consumer1-name">{organisation.name}</div>;
      };

      const Consumer2 = () => {
        const { organisation } = useOrganisation();
        return <div data-testid="consumer2-name">{organisation.name}</div>;
      };

      render(
        <OrganisationProvider organisation={mockOrganisation}>
          <Consumer1 />
          <Consumer2 />
        </OrganisationProvider>
      );

      expect(screen.getByTestId('consumer1-name')).toHaveTextContent('test-org');
      expect(screen.getByTestId('consumer2-name')).toHaveTextContent('test-org');
    });
  });
});
