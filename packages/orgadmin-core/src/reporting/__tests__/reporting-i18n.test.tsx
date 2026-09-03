/**
 * Reporting Module i18n Tests
 * 
 * Tests that reporting module components display translated text correctly
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { describe, it, expect, vi } from 'vitest';
import ReportingDashboardPage from '../pages/ReportingDashboardPage';
import EventsReportPage from '../pages/EventsReportPage';
import MembersReportPage from '../pages/MembersReportPage';
import RevenueReportPage from '../pages/RevenueReportPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import { TEST_ORGANISATION } from '../../test/renderWithProviders';
import { OrganisationProvider } from '../../context/OrganisationContext';

vi.mock('@itsplainsailing/orgadmin-shell/utils/currencyFormatting', () => import('../../test/orgadminShellMock'));
vi.mock('@itsplainsailing/orgadmin-shell/utils/dateFormatting', () => import('../../test/orgadminShellMock'));
vi.mock('@itsplainsailing/orgadmin-shell/context/LocaleContext', () => import('../../test/orgadminShellMock'));

// Shell hooks (translations, onboarding, page help, capabilities, locale)
// are mocked rather than provided — see test/orgadminShellMock.

// Mock the API hooks
vi.mock('../../hooks/useApi', () => ({
  useApiGet: () => ({
    data: null,
    error: null,
    loading: false,
    execute: vi.fn(),
  }),
  // The export asks for a workbook through a plain `useApi`, separately from
  // the report the page displays.
  useApi: () => ({
    data: null,
    error: null,
    loading: false,
    execute: vi.fn(),
  }),
}));

// Initialize i18n for testing
i18n.init({
  lng: 'en-GB',
  fallbackLng: 'en-GB',
  resources: {
    'en-GB': {
      translation: {
        reporting: {
          exportToExcel: 'Export to Excel',
          exporting: 'Preparing…',
          exportFailed: 'We could not produce that report. Please try again.',
          dashboard: {
            title: 'Reports & Analytics',
            subtitle: 'High-level metrics and trends for your organisation',
            dateRange: 'Date Range',
            startDate: 'Start Date',
            endDate: 'End Date',
            exportReport: 'Export Report',
            detailedReports: 'Detailed Reports',
            noData: 'No reporting data available for the selected date range. Please try a different date range.',
          },
          events: {
            title: 'Events Report',
            subtitle: 'Event attendance and revenue analysis',
            backToReports: 'Back to Reports',
            filters: 'Filters',
          },
          members: {
            title: 'Members Report',
            subtitle: 'Membership growth and retention analysis',
            backToReports: 'Back to Reports',
            filters: 'Filters',
          },
          revenue: {
            title: 'Revenue Report',
            subtitle: 'Revenue breakdown by source and trends',
            backToReports: 'Back to Reports',
            dateRange: 'Date Range',
          },
          filters: {
            startDate: 'Start Date',
            endDate: 'End Date',
            status: 'Status',
            all: 'All',
          },
        },
      },
    },
  },
});

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <I18nextProvider i18n={i18n}>
        <OrganisationProvider organisation={TEST_ORGANISATION}>
          {component}
        </OrganisationProvider>
      </I18nextProvider>
    </BrowserRouter>
  );
};

describe('Reporting Module i18n', () => {
  describe('ReportingDashboardPage', () => {
    it('displays translated title and subtitle', () => {
      renderWithProviders(<ReportingDashboardPage />);
      
      expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
      expect(screen.getByText('High-level metrics and trends for your organisation')).toBeInTheDocument();
    });


    it('displays translated export button', () => {
      renderWithProviders(<ReportingDashboardPage />);
      
      expect(screen.getAllByText('Export Report')[0]).toBeInTheDocument();
    });
  });

  describe('EventsReportPage', () => {
    it('displays translated title and subtitle', () => {
      renderWithProviders(<EventsReportPage />);
      
      expect(screen.getByText('Events Report')).toBeInTheDocument();
      expect(screen.getByText('Event attendance and revenue analysis')).toBeInTheDocument();
    });

    it('displays translated back button', () => {
      renderWithProviders(<EventsReportPage />);
      
      expect(screen.getByText('Back to Reports')).toBeInTheDocument();
    });

    it('displays translated export button', () => {
      renderWithProviders(<EventsReportPage />);
      
      expect(screen.getByText('Export to Excel')).toBeInTheDocument();
    });

    it('displays translated filters section', () => {
      renderWithProviders(<EventsReportPage />);
      
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });
  });

  describe('MembersReportPage', () => {
    it('displays translated title and subtitle', () => {
      renderWithProviders(<MembersReportPage />);
      
      expect(screen.getByText('Members Report')).toBeInTheDocument();
      expect(screen.getByText('Membership growth and retention analysis')).toBeInTheDocument();
    });

    it('displays translated back button', () => {
      renderWithProviders(<MembersReportPage />);
      
      expect(screen.getByText('Back to Reports')).toBeInTheDocument();
    });

    it('displays translated export button', () => {
      renderWithProviders(<MembersReportPage />);
      
      expect(screen.getByText('Export to Excel')).toBeInTheDocument();
    });
  });

  describe('RevenueReportPage', () => {
    it('displays translated title and subtitle', () => {
      renderWithProviders(<RevenueReportPage />);
      
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
      expect(screen.getByText('Revenue breakdown by source and trends')).toBeInTheDocument();
    });

    it('displays translated back button', () => {
      renderWithProviders(<RevenueReportPage />);
      
      expect(screen.getByText('Back to Reports')).toBeInTheDocument();
    });

    it('displays translated export button', () => {
      renderWithProviders(<RevenueReportPage />);
      
      expect(screen.getByText('Export to Excel')).toBeInTheDocument();
    });

    it('displays translated date range section', () => {
      renderWithProviders(<RevenueReportPage />);
      
      expect(screen.getByText('Date Range')).toBeInTheDocument();
    });
  });
});
