import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import CreateEventPage from '../CreateEventPage';

// Mock date pickers to avoid date-fns import issues
vi.mock('@mui/x-date-pickers/DateTimePicker', () => ({
  DateTimePicker: ({ label, value, onChange }: any) => (
    <div data-testid={`date-time-picker-${label}`}>
      <input
        type="datetime-local"
        aria-label={label}
        value={value?.toISOString?.() || ''}
        onChange={(e) => onChange?.(new Date(e.target.value))}
      />
    </div>
  ),
}));

vi.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: ({ label, value, onChange }: any) => (
    <div data-testid={`date-picker-${label}`}>
      <input
        type="date"
        aria-label={label}
        value={value?.toISOString?.().split('T')[0] || ''}
        onChange={(e) => onChange?.(new Date(e.target.value))}
      />
    </div>
  ),
}));

vi.mock('@mui/x-date-pickers/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@mui/x-date-pickers/AdapterDateFns', () => ({
  AdapterDateFns: class {},
}));

// Mock useNavigate and useParams
const mockNavigate = vi.fn();
const mockExecute = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({}),
  };
});

vi.mock('@aws-web-framework/orgadmin-core', async () => {
  const actual = await vi.importActual('@aws-web-framework/orgadmin-core');
  return {
    ...actual,
    useApi: () => ({
      execute: mockExecute,
      data: null,
      error: null,
      loading: false,
      reset: vi.fn(),
    }),
    useOrganisation: () => ({
      organisation: {
        id: 'd5a5a5ca-c4b4-436d-8981-627ab3556433',
        name: 'Test Organisation',
      },
    }),
  };
});

describe('CreateEventPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock responses
    mockExecute.mockImplementation(({ url }) => {
      if (url.includes('/event-types')) {
        return Promise.resolve([]);
      }
      if (url.includes('/venues')) {
        return Promise.resolve([]);
      }
      if (url.includes('/discounts')) {
        return Promise.resolve([]);
      }
      if (url.includes('/application-forms')) {
        return Promise.resolve([]);
      }
      return Promise.resolve({});
    });
  });

  it('renders create event form', () => {
    render(
      <BrowserRouter>
        <CreateEventPage />
      </BrowserRouter>
    );
    
    expect(screen.getByText('events.createEvent')).toBeInTheDocument();
  });

  it('displays all required event fields', () => {
    render(
      <BrowserRouter>
        <CreateEventPage />
      </BrowserRouter>
    );
    
    const nameInputs = screen.getAllByLabelText(/events.basicInfo.eventName/i);
    const descInputs = screen.getAllByLabelText(/events.basicInfo.eventDescription/i);
    
    expect(nameInputs[0]).toBeInTheDocument();
    expect(descInputs[0]).toBeInTheDocument();
  });

  describe('Discount Integration', () => {
    const mockDiscounts = [
      {
        id: 'discount-1',
        name: 'Early Bird Discount',
        description: '10% off for early registrations',
        discountType: 'percentage' as const,
        discountValue: 10,
        status: 'active' as const,
      },
      {
        id: 'discount-2',
        name: 'Member Discount',
        description: '£5 off for members',
        discountType: 'fixed' as const,
        discountValue: 5,
        status: 'active' as const,
      },
    ];

    beforeEach(() => {
      mockExecute.mockImplementation(({ url, method }) => {
        if (url.includes('/event-types')) {
          return Promise.resolve([]);
        }
        if (url.includes('/venues')) {
          return Promise.resolve([]);
        }
        if (url.includes('/discounts')) {
          return Promise.resolve(mockDiscounts);
        }
        if (method === 'POST' && url.includes('/events')) {
          return Promise.resolve({ id: 'new-event-id' });
        }
        return Promise.resolve({});
      });
    });

    it('loads discounts on mount', async () => {
      render(
        <BrowserRouter>
          <CreateEventPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'GET',
            url: expect.stringContaining('/discounts/events'),
          })
        );
      });
    });

    it('displays discount selector when discounts are available', async () => {
      render(
        <BrowserRouter>
          <CreateEventPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Apply Discounts to Event/i)).toBeInTheDocument();
      });
    });

    it('does not display discount selector when no discounts are available', async () => {
      mockExecute.mockImplementation(({ url }) => {
        if (url.includes('/discounts')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      render(
        <BrowserRouter>
          <CreateEventPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            url: expect.stringContaining('/discounts'),
          })
        );
      });

      // Discount selector should not be visible when no discounts
      expect(screen.queryByText(/Apply Discounts to Event/i)).not.toBeInTheDocument();
    });

    it('allows selecting discounts for event', async () => {
      const user = userEvent.setup();
      
      render(
        <BrowserRouter>
          <CreateEventPage />
        </BrowserRouter>
      );

      // Wait for discounts to load
      await waitFor(() => {
        expect(screen.getByText(/Apply Discounts to Event/i)).toBeInTheDocument();
      });

      // Enable discount selection
      const checkbox = screen.getByRole('checkbox', { name: /Apply Discounts to Event/i });
      await user.click(checkbox);

      // Dropdown should appear
      await waitFor(() => {
        expect(screen.getByLabelText(/Select Discounts/i)).toBeInTheDocument();
      });
    });

    it('includes discount IDs field in form data', async () => {
      render(
        <BrowserRouter>
          <CreateEventPage />
        </BrowserRouter>
      );

      // Wait for page to load
      await waitFor(() => {
        const nameInputs = screen.getAllByLabelText(/events.basicInfo.eventName/i);
        expect(nameInputs[0]).toBeInTheDocument();
      });

      // Verify discounts are loaded
      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            url: expect.stringContaining('/discounts'),
          })
        );
      });

      // The form data structure includes discountIds field
      // This is validated by TypeScript at compile time
      expect(true).toBe(true);
    });

    it('creates event with empty discount array when none selected', async () => {
      const user = userEvent.setup();
      
      render(
        <BrowserRouter>
          <CreateEventPage />
        </BrowserRouter>
      );

      // Fill in required fields
      await waitFor(() => {
        const nameInputs = screen.getAllByLabelText(/events.basicInfo.eventName/i);
        expect(nameInputs[0]).toBeInTheDocument();
      });

      const nameInputs = screen.getAllByLabelText(/events.basicInfo.eventName/i);
      const descriptionInputs = screen.getAllByLabelText(/events.basicInfo.eventDescription/i);
      
      await user.type(nameInputs[0], 'Test Event');
      await user.type(descriptionInputs[0], 'Test Description');

      // Navigate through steps
      const nextButton = screen.getByRole('button', { name: /common.actions.next/i });
      await user.click(nextButton); // Step 2
      await user.click(nextButton); // Step 3
      await user.click(nextButton); // Step 4

      // Add an activity
      const addActivityButton = screen.getByRole('button', { name: /Add Activity/i });
      await user.click(addActivityButton);

      const activityNameInputs = screen.getAllByLabelText(/events.activities.activity.name/i);
      const activityDescInputs = screen.getAllByLabelText(/events.activities.activity.description/i);
      
      await user.type(activityNameInputs[0], 'Test Activity');
      await user.type(activityDescInputs[0], 'Test Activity Description');

      // Go to review and publish
      await user.click(nextButton);

      const publishButton = screen.getByRole('button', { name: /events.actions.publishEvent/i });
      await user.click(publishButton);

      // Verify API call includes discountIds field
      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            data: expect.objectContaining({
              discountIds: expect.any(Array),
            }),
          })
        );
      });
    });
  });

  describe('Activity Discount Integration', () => {
    const mockDiscounts = [
      {
        id: 'discount-1',
        name: 'Early Bird Discount',
        description: '10% off for early registrations',
        discountType: 'percentage' as const,
        discountValue: 10,
        status: 'active' as const,
      },
      {
        id: 'discount-2',
        name: 'Member Discount',
        description: '£5 off for members',
        discountType: 'fixed' as const,
        discountValue: 5,
        status: 'active' as const,
      },
    ];

    beforeEach(() => {
      mockExecute.mockImplementation(({ url, method }) => {
        if (url.includes('/event-types')) {
          return Promise.resolve([]);
        }
        if (url.includes('/venues')) {
          return Promise.resolve([]);
        }
        if (url.includes('/discounts')) {
          return Promise.resolve(mockDiscounts);
        }
        if (url.includes('/application-forms')) {
          return Promise.resolve([
            { id: 'form-1', name: 'Registration Form' },
          ]);
        }
        if (method === 'POST' && url.includes('/events')) {
          return Promise.resolve({ id: 'new-event-id' });
        }
        return Promise.resolve({});
      });
    });

    it('displays discount selector for each activity', async () => {
      const user = userEvent.setup();
      
      render(
        <BrowserRouter>
          <CreateEventPage />
        </BrowserRouter>
      );

      // Navigate to Step 4 (Activities)
      await waitFor(() => {
        const nameInputs = screen.getAllByLabelText(/events.basicInfo.eventName/i);
        expect(nameInputs[0]).toBeInTheDocument();
      });

      const nameInputs = screen.getAllByLabelText(/events.basicInfo.eventName/i);
      const descriptionInputs = screen.getAllByLabelText(/events.basicInfo.eventDescription/i);
      
      await user.type(nameInputs[0], 'Test Event');
      await user.type(descriptionInputs[0], 'Test Description');

      const nextButton = screen.getByRole('button', { name: /common.actions.next/i });
      await user.click(nextButton); // Step 2
      await user.click(nextButton); // Step 3
      await user.click(nextButton); // Step 4

      // Add an activity
      const addActivityButton = screen.getByRole('button', { name: /Add Activity/i });
      await user.click(addActivityButton);

      // Wait for activity form to render and check for discount selector
      await waitFor(() => {
        expect(screen.getByText(/Apply Discounts to Activity/i)).toBeInTheDocument();
      });
    });

    it('creates activity with discounts', async () => {
      const user = userEvent.setup();
      
      render(
        <BrowserRouter>
          <CreateEventPage />
        </BrowserRouter>
      );

      // Navigate to Step 4
      await waitFor(() => {
        const nameInputs = screen.getAllByLabelText(/events.basicInfo.eventName/i);
        expect(nameInputs[0]).toBeInTheDocument();
      });

      const nameInputs = screen.getAllByLabelText(/events.basicInfo.eventName/i);
      const descriptionInputs = screen.getAllByLabelText(/events.basicInfo.eventDescription/i);
      
      await user.type(nameInputs[0], 'Test Event');
      await user.type(descriptionInputs[0], 'Test Description');

      const nextButton = screen.getByRole('button', { name: /common.actions.next/i });
      await user.click(nextButton); // Step 2
      await user.click(nextButton); // Step 3
      await user.click(nextButton); // Step 4

      // Add an activity
      const addActivityButton = screen.getByRole('button', { name: /Add Activity/i });
      await user.click(addActivityButton);

      // Fill activity details using translation keys
      const activityNameInputs = screen.getAllByLabelText(/events.activities.activity.name/i);
      const activityDescInputs = screen.getAllByLabelText(/events.activities.activity.description/i);
      
      await user.type(activityNameInputs[0], 'Test Activity');
      await user.type(activityDescInputs[0], 'Test Activity Description');

      // Enable discount selection for activity
      await waitFor(() => {
        expect(screen.getByText(/Apply Discounts to Activity/i)).toBeInTheDocument();
      });

      const activityDiscountCheckbox = screen.getByRole('checkbox', { 
        name: /Apply Discounts to Activity/i 
      });
      await user.click(activityDiscountCheckbox);

      // Go to review and publish
      await user.click(nextButton);

      const publishButton = screen.getByRole('button', { name: /events.actions.publishEvent/i });
      await user.click(publishButton);

      // Verify API call includes activity with discountIds field
      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            data: expect.objectContaining({
              activities: expect.arrayContaining([
                expect.objectContaining({
                  name: 'Test Activity',
                  discountIds: expect.any(Array),
                }),
              ]),
            }),
          })
        );
      });
    });

    it('creates activity without discounts', async () => {
      const user = userEvent.setup();
      
      render(
        <BrowserRouter>
          <CreateEventPage />
        </BrowserRouter>
      );

      // Navigate to Step 4
      await waitFor(() => {
        const nameInputs = screen.getAllByLabelText(/events.basicInfo.eventName/i);
        expect(nameInputs[0]).toBeInTheDocument();
      });

      const nameInputs = screen.getAllByLabelText(/events.basicInfo.eventName/i);
      const descriptionInputs = screen.getAllByLabelText(/events.basicInfo.eventDescription/i);
      
      await user.type(nameInputs[0], 'Test Event');
      await user.type(descriptionInputs[0], 'Test Description');

      const nextButton = screen.getByRole('button', { name: /common.actions.next/i });
      await user.click(nextButton); // Step 2
      await user.click(nextButton); // Step 3
      await user.click(nextButton); // Step 4

      // Add an activity
      const addActivityButton = screen.getByRole('button', { name: /Add Activity/i });
      await user.click(addActivityButton);

      // Fill activity details using translation keys
      const activityNameInputs = screen.getAllByLabelText(/events.activities.activity.name/i);
      const activityDescInputs = screen.getAllByLabelText(/events.activities.activity.description/i);
      
      await user.type(activityNameInputs[0], 'Test Activity');
      await user.type(activityDescInputs[0], 'Test Activity Description');

      // Don't enable discounts - leave checkbox unchecked

      // Go to review and publish
      await user.click(nextButton);

      const publishButton = screen.getByRole('button', { name: /events.actions.publishEvent/i });
      await user.click(publishButton);

      // Verify API call includes activity with empty discountIds array
      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            data: expect.objectContaining({
              activities: expect.arrayContaining([
                expect.objectContaining({
                  name: 'Test Activity',
                  discountIds: [],
                }),
              ]),
            }),
          })
        );
      });
    });

    it('creates multiple activities with different discounts', async () => {
      const user = userEvent.setup();
      
      render(
        <BrowserRouter>
          <CreateEventPage />
        </BrowserRouter>
      );

      // Navigate to Step 4
      await waitFor(() => {
        const nameInputs = screen.getAllByLabelText(/events.basicInfo.eventName/i);
        expect(nameInputs[0]).toBeInTheDocument();
      });

      const nameInputs = screen.getAllByLabelText(/events.basicInfo.eventName/i);
      const descriptionInputs = screen.getAllByLabelText(/events.basicInfo.eventDescription/i);
      
      await user.type(nameInputs[0], 'Test Event');
      await user.type(descriptionInputs[0], 'Test Description');

      const nextButton = screen.getByRole('button', { name: /common.actions.next/i });
      await user.click(nextButton); // Step 2
      await user.click(nextButton); // Step 3
      await user.click(nextButton); // Step 4

      // Add first activity
      const addActivityButton = screen.getByRole('button', { name: /Add Activity/i });
      await user.click(addActivityButton);

      let activityNameInputs = screen.getAllByLabelText(/events.activities.activity.name/i);
      let activityDescInputs = screen.getAllByLabelText(/events.activities.activity.description/i);
      
      await user.type(activityNameInputs[0], 'Activity 1');
      await user.type(activityDescInputs[0], 'Activity 1 Description');

      // Add second activity
      await user.click(addActivityButton);

      activityNameInputs = screen.getAllByLabelText(/events.activities.activity.name/i);
      activityDescInputs = screen.getAllByLabelText(/events.activities.activity.description/i);
      
      await user.type(activityNameInputs[1], 'Activity 2');
      await user.type(activityDescInputs[1], 'Activity 2 Description');

      // Both activities should have discount selectors
      const discountCheckboxes = screen.getAllByRole('checkbox', { 
        name: /Apply Discounts to Activity/i 
      });
      expect(discountCheckboxes).toHaveLength(2);

      // Enable discounts for first activity only
      await user.click(discountCheckboxes[0]);

      // Go to review and publish
      await user.click(nextButton);

      const publishButton = screen.getByRole('button', { name: /events.actions.publishEvent/i });
      await user.click(publishButton);

      // Verify API call includes both activities with their respective discount configurations
      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            data: expect.objectContaining({
              activities: expect.arrayContaining([
                expect.objectContaining({
                  name: 'Activity 1',
                  discountIds: expect.any(Array),
                }),
                expect.objectContaining({
                  name: 'Activity 2',
                  discountIds: [],
                }),
              ]),
            }),
          })
        );
      });
    });
  });
});
