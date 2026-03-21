/**
 * useEventForm Hook
 *
 * Extracted from CreateEventPage – encapsulates all form state management,
 * change handlers, activity CRUD, reference-data loading (event types, venues,
 * payment methods, discounts), and the ability to load an existing event for editing.
 *
 * Both CreateEventPage and EditEventPage consume this hook so that form
 * behaviour stays identical across the two flows.
 */

import { useState, useEffect, useCallback } from 'react';
import { useApi, useOrganisation } from '@aws-web-framework/orgadmin-core';
import type { Discount } from '@aws-web-framework/components';
import type { EventFormData, EventActivityFormData } from '../types/event.types';

export interface UseEventFormReturn {
  formData: EventFormData;
  setFormData: React.Dispatch<React.SetStateAction<EventFormData>>;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  loading: boolean;
  error: string | null;
  eventTypes: Array<{ id: string; name: string }>;
  venues: Array<{ id: string; name: string }>;
  paymentMethods: Array<{ id: string; name: string }>;
  discounts: Discount[];
  handleChange: (field: keyof EventFormData, value: any) => void;
  handleAddActivity: () => void;
  handleUpdateActivity: (index: number, activity: EventActivityFormData) => void;
  handleRemoveActivity: (index: number) => void;
  handleClearFieldError: (field: string) => void;
  fetchDiscounts: (organisationId: string, moduleType: string) => Promise<Discount[]>;
  loadEvent: (eventId: string) => Promise<void>;
}

const DEFAULT_FORM_DATA: EventFormData = {
  name: '',
  description: '',
  eventOwner: '',
  emailNotifications: '',
  startDate: new Date(),
  endDate: new Date(),
  openDateEntries: new Date(),
  entriesClosingDate: new Date(),
  limitEntries: false,
  entriesLimit: undefined,
  addConfirmationMessage: false,
  confirmationMessage: undefined,
  status: 'draft',
  activities: [],
  eventTypeId: undefined,
  venueId: undefined,
  // Ticketing configuration
  generateElectronicTickets: false,
  ticketHeaderText: undefined,
  ticketInstructions: undefined,
  ticketFooterText: undefined,
  ticketValidityPeriod: undefined,
  includeEventLogo: false,
  ticketBackgroundColor: '#ffffff',
  // Discount configuration
  discountIds: [],
};

const DEFAULT_PAYMENT_METHODS = [
  { id: 'pay-offline', name: 'Pay Offline' },
  { id: 'stripe', name: 'Card Payment (Stripe)' },
];

const FALLBACK_ORG_ID = 'd5a5a5ca-c4b4-436d-8981-627ab3556433';

export function useEventForm(): UseEventFormReturn {
  const { execute } = useApi();
  const { organisation } = useOrganisation();

  const [formData, setFormData] = useState<EventFormData>({ ...DEFAULT_FORM_DATA });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reference data
  const [eventTypes, setEventTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [venues, setVenues] = useState<Array<{ id: string; name: string }>>([]);
  const [paymentMethods, setPaymentMethods] = useState<Array<{ id: string; name: string }>>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);

  // ── Reference-data loaders ──────────────────────────────────────────

  const orgId = organisation?.id || FALLBACK_ORG_ID;

  const loadEventTypesAndVenues = useCallback(async () => {
    try {
      const [eventTypesResponse, venuesResponse] = await Promise.all([
        execute({
          method: 'GET',
          url: `/api/orgadmin/organisations/${orgId}/event-types`,
        }).catch(() => []),
        execute({
          method: 'GET',
          url: `/api/orgadmin/organisations/${orgId}/venues`,
        }).catch(() => []),
      ]);

      setEventTypes(eventTypesResponse || []);
      setVenues(venuesResponse || []);
    } catch (err) {
      console.error('Failed to load event types and venues:', err);
    }
  }, [execute, orgId]);

  const loadDiscounts = useCallback(async () => {
    try {
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisations/${orgId}/discounts/events`,
      });
      setDiscounts(response?.discounts || []);
    } catch (err) {
      console.error('Failed to load discounts:', err);
      setDiscounts([]);
    }
  }, [execute, orgId]);

  const loadPaymentMethods = useCallback(async () => {
    try {
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/payment-methods',
      });
      setPaymentMethods(response || DEFAULT_PAYMENT_METHODS);
    } catch (err) {
      console.error('Failed to load payment methods:', err);
      setPaymentMethods(DEFAULT_PAYMENT_METHODS);
    }
  }, [execute]);

  // Load reference data on mount
  useEffect(() => {
    loadEventTypesAndVenues();
    loadDiscounts();
    loadPaymentMethods();
  }, [loadEventTypesAndVenues, loadDiscounts, loadPaymentMethods]);

  // ── fetchDiscounts (for DiscountSelector) ───────────────────────────

  const fetchDiscounts = useCallback(
    async (organisationId: string, moduleType: string): Promise<Discount[]> => {
      try {
        const response = await execute({
          method: 'GET',
          url: `/api/orgadmin/organisations/${organisationId}/discounts/${moduleType}`,
        });
        return response?.discounts || [];
      } catch (err) {
        console.error('Failed to fetch discounts:', err);
        return [];
      }
    },
    [execute],
  );

  // ── loadEvent (for edit mode) ───────────────────────────────────────

  const loadEvent = useCallback(
    async (eventId: string): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        const response = await execute({
          method: 'GET',
          url: `/api/orgadmin/events/${eventId}`,
        });

        const eventData: EventFormData = {
          ...response,
          startDate: response.startDate ? new Date(response.startDate) : new Date(),
          endDate: response.endDate ? new Date(response.endDate) : new Date(),
          openDateEntries: response.openDateEntries
            ? new Date(response.openDateEntries)
            : new Date(),
          entriesClosingDate: response.entriesClosingDate
            ? new Date(response.entriesClosingDate)
            : new Date(),
          activities: Array.isArray(response.activities) ? response.activities : [],
          discountIds: response.discountIds || [],
        };

        setFormData(eventData);
      } catch (err) {
        console.error('Failed to load event:', err);
        setError('Failed to load event');
      } finally {
        setLoading(false);
      }
    },
    [execute],
  );

  // ── Change handler ──────────────────────────────────────────────────

  const handleChange = useCallback(
    (field: keyof EventFormData, value: any) => {
      setFormData((prev) => {
        const updated = { ...prev, [field]: value };

        // When start date changes, update end date to match if end date is before start date
        if (field === 'startDate' && value) {
          if (!updated.endDate || updated.endDate < value) {
            updated.endDate = value;
          }
        }

        // Prevent end date from being before start date
        if (field === 'endDate' && value && updated.startDate) {
          if (value < updated.startDate) {
            updated.endDate = updated.startDate;
            return updated;
          }
        }

        // When entries opening date changes, update closing date if needed
        if (field === 'openDateEntries' && value) {
          if (!updated.entriesClosingDate || updated.entriesClosingDate <= value) {
            const newClosingDate = new Date(value);
            newClosingDate.setHours(newClosingDate.getHours() + 1);
            updated.entriesClosingDate = newClosingDate;
          }
        }

        // Prevent entries closing date from being before or equal to opening date
        if (field === 'entriesClosingDate' && value && updated.openDateEntries) {
          if (value <= updated.openDateEntries) {
            const newClosingDate = new Date(updated.openDateEntries as Date);
            newClosingDate.setHours(newClosingDate.getHours() + 1);
            updated.entriesClosingDate = newClosingDate;
            return updated;
          }
        }

        return updated;
      });
    },
    [],
  );

  // ── Activity handlers ───────────────────────────────────────────────

  const handleAddActivity = useCallback(() => {
    const newActivity: EventActivityFormData = {
      name: '',
      description: '',
      showPublicly: true,
      applicationFormId: undefined,
      limitApplicants: false,
      applicantsLimit: undefined,
      allowSpecifyQuantity: false,
      useTermsAndConditions: false,
      termsAndConditions: undefined,
      fee: 0,
      supportedPaymentMethods: [],
      handlingFeeIncluded: false,
      chequePaymentInstructions: undefined,
      discountIds: [],
    };

    setFormData((prev) => ({
      ...prev,
      activities: [...prev.activities, newActivity],
    }));

    // Clear activities error when adding an activity
    setFieldErrors((prev) => {
      if (!prev.activities) return prev;
      const next = { ...prev };
      delete next.activities;
      return next;
    });
  }, []);

  const handleUpdateActivity = useCallback(
    (index: number, activity: EventActivityFormData) => {
      setFormData((prev) => ({
        ...prev,
        activities: prev.activities.map((a, i) => (i === index ? activity : a)),
      }));
    },
    [],
  );

  const handleRemoveActivity = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      activities: prev.activities.filter((_, i) => i !== index),
    }));
  }, []);

  // ── Field error helpers ─────────────────────────────────────────────

  const handleClearFieldError = useCallback((field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // ── Return ──────────────────────────────────────────────────────────

  return {
    formData,
    setFormData,
    fieldErrors,
    setFieldErrors,
    loading,
    error,
    eventTypes,
    venues,
    paymentMethods,
    discounts,
    handleChange,
    handleAddActivity,
    handleUpdateActivity,
    handleRemoveActivity,
    handleClearFieldError,
    fetchDiscounts,
    loadEvent,
  };
}
