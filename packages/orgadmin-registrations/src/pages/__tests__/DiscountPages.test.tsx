/**
 * Unit tests for discount page wrappers
 *
 * Tests that each discount page wrapper renders the corresponding events module
 * component with moduleType="registrations".
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4
 */

import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the events module BEFORE any dynamic imports of wrapper components.
// vi.mock is hoisted to the top of the file by vitest.
vi.mock('@aws-web-framework/orgadmin-events', () => ({
  DiscountsListPage: (props: any) => (
    <div data-testid="events-discounts-list-page" data-module-type={props.moduleType}>
      EventsDiscountsListPage
    </div>
  ),
  CreateDiscountPage: (props: any) => (
    <div data-testid="events-create-discount-page" data-module-type={props.moduleType}>
      EventsCreateDiscountPage
    </div>
  ),
}));

let DiscountsListPage: React.ComponentType;
let CreateDiscountPage: React.ComponentType;
let EditDiscountPage: React.ComponentType;

beforeAll(async () => {
  const discountsListMod = await import('../DiscountsListPage');
  DiscountsListPage = discountsListMod.default;

  const createDiscountMod = await import('../CreateDiscountPage');
  CreateDiscountPage = createDiscountMod.default;

  const editDiscountMod = await import('../EditDiscountPage');
  EditDiscountPage = editDiscountMod.default;
});

describe('Feature: registrations-module - Discount Page Wrappers', () => {
  describe('DiscountsListPage', () => {
    it('should render the events DiscountsListPage with moduleType="registrations"', () => {
      render(<DiscountsListPage />);

      const el = screen.getByTestId('events-discounts-list-page');
      expect(el).toBeInTheDocument();
      expect(el).toHaveAttribute('data-module-type', 'registrations');
    });
  });

  describe('CreateDiscountPage', () => {
    it('should render the events CreateDiscountPage with moduleType="registrations"', () => {
      render(<CreateDiscountPage />);

      const el = screen.getByTestId('events-create-discount-page');
      expect(el).toBeInTheDocument();
      expect(el).toHaveAttribute('data-module-type', 'registrations');
    });
  });

  describe('EditDiscountPage', () => {
    it('should render the events CreateDiscountPage with moduleType="registrations"', () => {
      render(<EditDiscountPage />);

      const el = screen.getByTestId('events-create-discount-page');
      expect(el).toBeInTheDocument();
      expect(el).toHaveAttribute('data-module-type', 'registrations');
    });
  });
});
