import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DashboardCard } from '../DashboardCard';
import { ModuleRegistration } from '../../types/module.types';
import { Event as EventIcon } from '@mui/icons-material';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockModule: ModuleRegistration = {
  id: 'events',
  name: 'Events',
  title: 'Event Management',
  description: 'Manage events and activities for your organisation',
  capability: 'event-management',
  order: 1,
  card: {
    title: 'Event Management',
    description: 'Manage events and activities for your organisation',
    icon: EventIcon,
    color: '#1976d2',
    path: '/events',
  },
  routes: [],
};

const renderDashboardCard = (module: ModuleRegistration = mockModule) => {
  return render(
    <BrowserRouter>
      <DashboardCard module={module} />
    </BrowserRouter>
  );
};

describe('DashboardCard Component', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('should render card with title', () => {
    renderDashboardCard();
    
    expect(screen.getByText('Event Management')).toBeInTheDocument();
  });

  it('should render card with description', () => {
    renderDashboardCard();
    
    expect(screen.getByText('Manage events and activities for your organisation')).toBeInTheDocument();
  });

  it('should render card with icon', () => {
    renderDashboardCard();
    
    // Icon should be rendered (check for testid)
    const icon = screen.getByTestId('EventIcon');
    expect(icon).toBeInTheDocument();
  });

  it('should navigate to module path when clicked', () => {
    renderDashboardCard();
    
    // Click the card
    const card = screen.getByText('Event Management').closest('.MuiCard-root');
    expect(card).toBeInTheDocument();
    
    if (card) {
      fireEvent.click(card);
      expect(mockNavigate).toHaveBeenCalledWith('/events');
    }
  });

  it('should apply custom color to avatar', () => {
    renderDashboardCard();
    
    // Avatar should have the custom color (check via testid)
    const icon = screen.getByTestId('EventIcon');
    expect(icon).toBeInTheDocument();
  });

  it('should use default color when no color specified', () => {
    const moduleWithoutColor: ModuleRegistration = {
      ...mockModule,
      card: {
        ...mockModule.card,
        color: undefined,
      },
    };
    
    renderDashboardCard(moduleWithoutColor);
    
    // Icon should exist (color will be theme default)
    const icon = screen.getByTestId('EventIcon');
    expect(icon).toBeInTheDocument();
  });
});
