import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CapabilitySelector } from '../CapabilitySelector';
import type { Capability } from '../../types/organization.types';

describe('CapabilitySelector', () => {
  const mockCapabilities: Capability[] = [
    {
      id: '1',
      name: 'event-management',
      displayName: 'Event Management',
      description: 'Manage events',
      category: 'core-service',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      name: 'memberships',
      displayName: 'Memberships',
      description: 'Manage memberships',
      category: 'core-service',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '3',
      name: 'merchandise',
      displayName: 'Merchandise',
      description: 'Sell merchandise',
      category: 'additional-feature',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  it('should render all capabilities', () => {
    const onChange = vi.fn();
    render(
      <CapabilitySelector
        capabilities={mockCapabilities}
        selectedCapabilities={[]}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Event Management')).toBeInTheDocument();
    expect(screen.getByText('Memberships')).toBeInTheDocument();
    expect(screen.getByText('Merchandise')).toBeInTheDocument();
  });

  it('should show "Select All" button when no capabilities are selected', () => {
    const onChange = vi.fn();
    render(
      <CapabilitySelector
        capabilities={mockCapabilities}
        selectedCapabilities={[]}
        onChange={onChange}
      />
    );

    expect(screen.getByRole('button', { name: /select all/i })).toBeInTheDocument();
  });

  it('should show "Deselect All" button when all capabilities are selected', () => {
    const onChange = vi.fn();
    render(
      <CapabilitySelector
        capabilities={mockCapabilities}
        selectedCapabilities={['event-management', 'memberships', 'merchandise']}
        onChange={onChange}
      />
    );

    expect(screen.getByRole('button', { name: /deselect all/i })).toBeInTheDocument();
  });

  it('should select all capabilities when "Select All" is clicked', () => {
    const onChange = vi.fn();
    render(
      <CapabilitySelector
        capabilities={mockCapabilities}
        selectedCapabilities={[]}
        onChange={onChange}
      />
    );

    const selectAllButton = screen.getByRole('button', { name: /select all/i });
    fireEvent.click(selectAllButton);

    expect(onChange).toHaveBeenCalledWith(['event-management', 'memberships', 'merchandise']);
  });

  it('should deselect all capabilities when "Deselect All" is clicked', () => {
    const onChange = vi.fn();
    render(
      <CapabilitySelector
        capabilities={mockCapabilities}
        selectedCapabilities={['event-management', 'memberships', 'merchandise']}
        onChange={onChange}
      />
    );

    const deselectAllButton = screen.getByRole('button', { name: /deselect all/i });
    fireEvent.click(deselectAllButton);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('should only show capabilities in defaultCapabilities when provided', () => {
    const onChange = vi.fn();
    render(
      <CapabilitySelector
        capabilities={mockCapabilities}
        selectedCapabilities={[]}
        onChange={onChange}
        defaultCapabilities={['event-management', 'memberships']}
      />
    );

    expect(screen.getByText('Event Management')).toBeInTheDocument();
    expect(screen.getByText('Memberships')).toBeInTheDocument();
    expect(screen.queryByText('Merchandise')).not.toBeInTheDocument();
  });

  it('should select only available capabilities when "Select All" is clicked with defaultCapabilities', () => {
    const onChange = vi.fn();
    render(
      <CapabilitySelector
        capabilities={mockCapabilities}
        selectedCapabilities={[]}
        onChange={onChange}
        defaultCapabilities={['event-management', 'memberships']}
      />
    );

    const selectAllButton = screen.getByRole('button', { name: /select all/i });
    fireEvent.click(selectAllButton);

    expect(onChange).toHaveBeenCalledWith(['event-management', 'memberships']);
  });

  it('should disable select/deselect all button when disabled prop is true', () => {
    const onChange = vi.fn();
    render(
      <CapabilitySelector
        capabilities={mockCapabilities}
        selectedCapabilities={[]}
        onChange={onChange}
        disabled={true}
      />
    );

    const selectAllButton = screen.getByRole('button', { name: /select all/i });
    expect(selectAllButton).toBeDisabled();
  });

  it('should mark default capabilities with a chip', () => {
    const onChange = vi.fn();
    render(
      <CapabilitySelector
        capabilities={mockCapabilities}
        selectedCapabilities={[]}
        onChange={onChange}
        defaultCapabilities={['event-management']}
      />
    );

    expect(screen.getByText('Default')).toBeInTheDocument();
  });
});
