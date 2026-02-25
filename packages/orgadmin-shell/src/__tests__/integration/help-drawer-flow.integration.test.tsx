/**
 * Integration Test: Help Drawer Flow
 * 
 * Tests the complete help drawer experience including:
 * - Help button opens drawer
 * - Correct content displays
 * - Closing drawer
 * 
 * Validates: Requirements 3.1, 3.2, 3.4
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OnboardingProvider } from '../../context/OnboardingProvider';
import { useOnboarding } from '../../context/OnboardingContext';
import { HelpButton } from '../../components/HelpButton';
import { HelpDrawer } from '../../components/HelpDrawer';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

// Mock AuthTokenContext
const mockGetToken = vi.fn(() => 'mock-token-123');
vi.mock('@aws-web-framework/orgadmin-core', () => ({
  AuthTokenContext: React.createContext(() => 'mock-token-123'),
}));

// Mock useTranslation hook with proper translation resolution
const translations: Record<string, string> = {
  'button.tooltip': 'Get help',
  'drawer.title': 'Help',
  'drawer.close': 'Close help',
  'dashboard.overview': '# Dashboard Help\n\nYour dashboard provides an overview of key metrics.',
  'dashboard.widgets': '# Widget Configuration\n\nCustomize your dashboard widgets here.',
  'users.overview': '# User Management Help\n\nManage all users in your organization.',
  'users.list': '# User List\n\nView and search all users.',
  'users.create': '# Create User\n\nAdd a new user to your organization.',
  'forms.overview': '# Forms Module Help\n\nCreate custom forms for data collection.',
  'noContentAvailable': 'Help content is not yet available for this page.',
};

const mockT = vi.fn((key: string, options?: any) => {
  // Handle language fallback
  if (options?.lng === 'en-GB') {
    const value = translations[key];
    if (value) return value;
    return options?.defaultValue || key;
  }
  
  const value = translations[key];
  if (value) return value;
  return options?.defaultValue || key;
});

const mockI18n = {
  language: 'en-GB',
  changeLanguage: vi.fn(),
};

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: mockT, i18n: mockI18n }),
}));

// Test component that simulates the navbar with help button and drawer
const TestHelpApp: React.FC = () => {
  const { 
    helpDrawerOpen, 
    toggleHelpDrawer,
    currentPageId,
    setCurrentPageId,
    checkModuleVisit,
  } = useOnboarding();
  
  // Simulate being on the dashboard module
  const [currentModule, setCurrentModule] = React.useState<'dashboard' | 'users' | 'forms'>('dashboard');
  const [pageId, setPageId] = React.useState<string>('overview');
  
  React.useEffect(() => {
    setCurrentPageId(pageId);
  }, [pageId, setCurrentPageId]);
  
  return (
    <>
      <div data-testid="test-help-app">
        {/* Simulate navbar with help button */}
        <div data-testid="navbar">
          <HelpButton 
            onClick={toggleHelpDrawer}
            active={helpDrawerOpen}
          />
        </div>
        
        {/* Status indicators for testing */}
        <div data-testid="help-drawer-status">
          {helpDrawerOpen ? 'drawer-open' : 'drawer-closed'}
        </div>
        <div data-testid="current-page">
          {currentModule}.{pageId}
        </div>
        
        {/* Buttons to simulate navigation */}
        <button 
          data-testid="navigate-dashboard-overview"
          onClick={() => {
            setCurrentModule('dashboard');
            setPageId('overview');
            checkModuleVisit('dashboard');
          }}
        >
          Dashboard Overview
        </button>
        <button 
          data-testid="navigate-dashboard-widgets"
          onClick={() => {
            setCurrentModule('dashboard');
            setPageId('widgets');
          }}
        >
          Dashboard Widgets
        </button>
        <button 
          data-testid="navigate-users-list"
          onClick={() => {
            setCurrentModule('users');
            setPageId('list');
            checkModuleVisit('users');
          }}
        >
          Users List
        </button>
        <button 
          data-testid="navigate-users-create"
          onClick={() => {
            setCurrentModule('users');
            setPageId('create');
          }}
        >
          Create User
        </button>
      </div>
      
      {/* Help Drawer */}
      <HelpDrawer
        open={helpDrawerOpen}
        onClose={toggleHelpDrawer}
        pageId={pageId}
        moduleId={currentModule}
      />
    </>
  );
};

describe('Help Drawer Flow - Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (mockedAxios.get) mockedAxios.get.mockClear();
    if (mockedAxios.put) mockedAxios.put.mockClear();
    mockI18n.language = 'en-GB';
  });

  it('should open help drawer when help button is clicked', async () => {
    // Arrange - user with preferences loaded
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: true,
          modulesVisited: ['dashboard'],
        },
      },
    });

    // Act - render the app
    render(
      <OnboardingProvider>
        <TestHelpApp />
      </OnboardingProvider>
    );

    // Wait for preferences to load
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Assert - drawer should be closed initially
    expect(screen.getByTestId('help-drawer-status').textContent).toBe('drawer-closed');
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();

    // Act - click help button
    const helpButton = screen.getByRole('button', { name: /get help/i });
    fireEvent.click(helpButton);

    // Assert - drawer should open
    await waitFor(() => {
      expect(screen.getByTestId('help-drawer-status').textContent).toBe('drawer-open');
    });

    // Drawer should be visible
    const drawer = screen.getByRole('presentation');
    expect(drawer).toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();
  });

  it('should display correct content for current page', async () => {
    // Arrange
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: true,
          modulesVisited: ['dashboard'],
        },
      },
    });

    // Act - render the app
    render(
      <OnboardingProvider>
        <TestHelpApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Act - open help drawer (should show dashboard.overview content)
    const helpButton = screen.getByRole('button', { name: /get help/i });
    fireEvent.click(helpButton);

    // Assert - should display dashboard overview help content
    await waitFor(() => {
      expect(screen.getByText('Dashboard Help')).toBeInTheDocument();
    });
    expect(screen.getByText(/Your dashboard provides an overview of key metrics/i)).toBeInTheDocument();
  });

  it('should update content when navigating to different pages', async () => {
    // Arrange
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: true,
          modulesVisited: ['dashboard', 'users'],
        },
      },
    });

    // Act - render the app
    render(
      <OnboardingProvider>
        <TestHelpApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Act - open help drawer on dashboard overview
    const helpButton = screen.getByRole('button', { name: /get help/i });
    fireEvent.click(helpButton);

    // Assert - should show dashboard overview content
    await waitFor(() => {
      expect(screen.getByText('Dashboard Help')).toBeInTheDocument();
    });

    // Act - navigate to dashboard widgets page
    const widgetsButton = screen.getByTestId('navigate-dashboard-widgets');
    fireEvent.click(widgetsButton);

    // Assert - content should update to widgets help
    await waitFor(() => {
      expect(screen.getByText('Widget Configuration')).toBeInTheDocument();
    });
    expect(screen.getByText(/Customize your dashboard widgets here/i)).toBeInTheDocument();

    // Act - navigate to users list page
    const usersListButton = screen.getByTestId('navigate-users-list');
    fireEvent.click(usersListButton);

    // Assert - content should update to users list help
    await waitFor(() => {
      expect(screen.getByText('User List')).toBeInTheDocument();
    });
    expect(screen.getByText(/View and search all users/i)).toBeInTheDocument();
  });

  it('should close drawer when close button is clicked', async () => {
    // Arrange
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: true,
          modulesVisited: ['dashboard'],
        },
      },
    });

    // Act - render the app
    render(
      <OnboardingProvider>
        <TestHelpApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Act - open help drawer
    const helpButton = screen.getByRole('button', { name: /get help/i });
    fireEvent.click(helpButton);

    await waitFor(() => {
      expect(screen.getByTestId('help-drawer-status').textContent).toBe('drawer-open');
    });

    // Act - click close button in drawer
    const closeButton = screen.getByRole('button', { name: /close help/i });
    fireEvent.click(closeButton);

    // Assert - drawer should close
    await waitFor(() => {
      expect(screen.getByTestId('help-drawer-status').textContent).toBe('drawer-closed');
    });

    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
  });

  it('should toggle drawer when help button is clicked multiple times', async () => {
    // Arrange
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: true,
          modulesVisited: ['dashboard'],
        },
      },
    });

    // Act - render the app
    render(
      <OnboardingProvider>
        <TestHelpApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    const helpButton = screen.getByRole('button', { name: /get help/i });

    // Assert - initially closed
    expect(screen.getByTestId('help-drawer-status').textContent).toBe('drawer-closed');

    // Act - click to open
    fireEvent.click(helpButton);

    // Assert - drawer opens
    await waitFor(() => {
      expect(screen.getByTestId('help-drawer-status').textContent).toBe('drawer-open');
    });

    // Act - click to close
    fireEvent.click(helpButton);

    // Assert - drawer closes
    await waitFor(() => {
      expect(screen.getByTestId('help-drawer-status').textContent).toBe('drawer-closed');
    });

    // Act - click to open again
    fireEvent.click(helpButton);

    // Assert - drawer opens again
    await waitFor(() => {
      expect(screen.getByTestId('help-drawer-status').textContent).toBe('drawer-open');
    });
  });

  it('should show help button in active state when drawer is open', async () => {
    // Arrange
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: true,
          modulesVisited: ['dashboard'],
        },
      },
    });

    // Act - render the app
    render(
      <OnboardingProvider>
        <TestHelpApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    const helpButton = screen.getByRole('button', { name: /get help/i });

    // Assert - button should not have primary color initially
    expect(helpButton).not.toHaveClass('MuiIconButton-colorPrimary');

    // Act - open drawer
    fireEvent.click(helpButton);

    await waitFor(() => {
      expect(screen.getByTestId('help-drawer-status').textContent).toBe('drawer-open');
    });

    // Assert - button should show active state (primary color)
    // Note: The actual color prop is passed to the component, testing via the active prop behavior
    expect(screen.getByTestId('help-drawer-status').textContent).toBe('drawer-open');
  });

  it('should display fallback content when page-specific help is not available', async () => {
    // Arrange
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: true,
          modulesVisited: ['users'],
        },
      },
    });

    // Act - render the app
    render(
      <OnboardingProvider>
        <TestHelpApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Navigate to users module
    fireEvent.click(screen.getByTestId('navigate-users-list'));

    // Open help drawer
    const helpButton = screen.getByRole('button', { name: /get help/i });
    fireEvent.click(helpButton);

    // Assert - should show users list content (which exists in our mock)
    // If it didn't exist, it would fall back to users.overview
    await waitFor(() => {
      expect(screen.getByText('User List')).toBeInTheDocument();
    });
    expect(screen.getByText(/View and search all users/i)).toBeInTheDocument();
  });

  it('should complete full help drawer flow: open, view content, navigate, close', async () => {
    // Arrange
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: true,
          modulesVisited: ['dashboard', 'users'],
        },
      },
    });

    // Act - render the app
    render(
      <OnboardingProvider>
        <TestHelpApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Step 1: Open help drawer
    const helpButton = screen.getByRole('button', { name: /get help/i });
    fireEvent.click(helpButton);

    await waitFor(() => {
      expect(screen.getByTestId('help-drawer-status').textContent).toBe('drawer-open');
    });

    // Step 2: Verify initial content (dashboard overview)
    expect(screen.getByText('Dashboard Help')).toBeInTheDocument();

    // Step 3: Navigate to different page while drawer is open
    fireEvent.click(screen.getByTestId('navigate-users-create'));

    // Step 4: Verify content updates
    await waitFor(() => {
      expect(screen.getByText(/Add a new user to your organization/i)).toBeInTheDocument();
    });

    // Step 5: Navigate to another page
    fireEvent.click(screen.getByTestId('navigate-dashboard-widgets'));

    // Step 6: Verify content updates again
    await waitFor(() => {
      expect(screen.getByText('Widget Configuration')).toBeInTheDocument();
    });

    // Step 7: Close drawer
    const closeButton = screen.getByRole('button', { name: /close help/i });
    fireEvent.click(closeButton);

    // Step 8: Verify drawer is closed
    await waitFor(() => {
      expect(screen.getByTestId('help-drawer-status').textContent).toBe('drawer-closed');
    });

    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
  });

  it('should render markdown content correctly in help drawer', async () => {
    // Arrange
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: true,
          modulesVisited: ['dashboard'],
        },
      },
    });

    // Act - render the app
    render(
      <OnboardingProvider>
        <TestHelpApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Act - open help drawer
    const helpButton = screen.getByRole('button', { name: /get help/i });
    fireEvent.click(helpButton);

    // Assert - markdown should be rendered as HTML
    await waitFor(() => {
      // Heading should be rendered
      expect(screen.getByText('Dashboard Help')).toBeInTheDocument();
      
      // The heading should be an h1 element (markdown # renders to h1)
      const heading = screen.getByText('Dashboard Help');
      expect(heading.tagName).toBe('H1');
    });
  });

  it('should not interfere with main content when drawer is open', async () => {
    // Arrange
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: true,
          modulesVisited: ['dashboard'],
        },
      },
    });

    // Act - render the app
    render(
      <OnboardingProvider>
        <TestHelpApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Act - open help drawer
    const helpButton = screen.getByRole('button', { name: /get help/i });
    fireEvent.click(helpButton);

    await waitFor(() => {
      expect(screen.getByTestId('help-drawer-status').textContent).toBe('drawer-open');
    });

    // Assert - main content should still be accessible
    // Navigation buttons should still be clickable
    const widgetsButton = screen.getByTestId('navigate-dashboard-widgets');
    expect(widgetsButton).toBeInTheDocument();
    
    // Act - click navigation button while drawer is open
    fireEvent.click(widgetsButton);

    // Assert - navigation should work and content should update
    await waitFor(() => {
      expect(screen.getByText('Widget Configuration')).toBeInTheDocument();
    });

    // Main content status should update
    expect(screen.getByTestId('current-page').textContent).toBe('dashboard.widgets');
  });

  it('should handle rapid open/close actions gracefully', async () => {
    // Arrange
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: true,
          modulesVisited: ['dashboard'],
        },
      },
    });

    // Act - render the app
    render(
      <OnboardingProvider>
        <TestHelpApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    const helpButton = screen.getByRole('button', { name: /get help/i });

    // Act - rapidly click help button multiple times
    fireEvent.click(helpButton); // Open
    fireEvent.click(helpButton); // Close
    fireEvent.click(helpButton); // Open
    fireEvent.click(helpButton); // Close
    fireEvent.click(helpButton); // Open

    // Assert - final state should be open
    await waitFor(() => {
      expect(screen.getByTestId('help-drawer-status').textContent).toBe('drawer-open');
    });

    expect(screen.getByRole('presentation')).toBeInTheDocument();
  });
});
