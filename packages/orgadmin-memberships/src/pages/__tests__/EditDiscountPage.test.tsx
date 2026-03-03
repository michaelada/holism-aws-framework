/**
 * Component tests for EditDiscountPage (Memberships wrapper)
 * 
 * Tests that the EditDiscountPage wrapper correctly passes moduleType='memberships'
 * to the CreateDiscountPage component from the events module.
 * 
 * **Validates: Requirements 2.3, 2.5**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import EditDiscountPage from '../EditDiscountPage';

// Mock the CreateDiscountPage from events module
const mockCreateDiscountPage = vi.fn(() => <div>Mocked CreateDiscountPage</div>);

vi.mock('@aws-web-framework/orgadmin-events', () => ({
  CreateDiscountPage: (props: any) => {
    mockCreateDiscountPage(props);
    return <div data-testid="create-discount-page">CreateDiscountPage with moduleType: {props.moduleType}</div>;
  },
}));

describe('EditDiscountPage (Memberships)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render CreateDiscountPage component', () => {
    render(
      <BrowserRouter>
        <EditDiscountPage />
      </BrowserRouter>
    );

    expect(screen.getByTestId('create-discount-page')).toBeInTheDocument();
  });

  it('should pass moduleType="memberships" to CreateDiscountPage', () => {
    render(
      <BrowserRouter>
        <EditDiscountPage />
      </BrowserRouter>
    );

    expect(mockCreateDiscountPage).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleType: 'memberships',
      })
    );
  });

  it('should display correct moduleType in rendered component', () => {
    render(
      <BrowserRouter>
        <EditDiscountPage />
      </BrowserRouter>
    );

    expect(screen.getByText('CreateDiscountPage with moduleType: memberships')).toBeInTheDocument();
  });

  it('should only pass moduleType prop to CreateDiscountPage', () => {
    render(
      <BrowserRouter>
        <EditDiscountPage />
      </BrowserRouter>
    );

    // Verify only moduleType is passed
    expect(mockCreateDiscountPage).toHaveBeenCalledWith({
      moduleType: 'memberships',
    });
  });
});
