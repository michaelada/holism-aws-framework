import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware';
import {
  resolveAccountOrganisation,
  requireAccountCapability,
  AccountRequest,
} from '../middleware/account-auth.middleware';
import { accountOrganisationService } from '../services/account-organisation.service';
import { cartService } from '../services/cart.service';
import { accountRegistrationService } from '../services/account-registration.service';
import { accountActivityService } from '../services/account-activity.service';
import { accountDashboardService } from '../services/account-dashboard.service';
import { checkoutService } from '../services/checkout.service';
import { accountCatalogueService } from '../services/account-catalogue.service';
import { accountTicketingService } from '../services/account-ticketing.service';
import { accountProfileService } from '../services/account-profile.service';
import { applicationFormService } from '../services/application-form.service';
import { formSubmissionService } from '../services/form-submission.service';
import { validateSubmissionData } from '../utils/application-field-validation';
import { ValidationError, NotFoundError } from '../middleware/errors';
import { logger } from '../config/logger';

/**
 * Authenticated endpoints for the account-user application.
 *
 * Two shapes of route:
 *
 *   /api/account/organisations        Not scoped to one organisation — this is
 *                                     what the switcher (A7) reads, and it has
 *                                     to work before any organisation is chosen.
 *
 *   /api/account/:orgCode/...         Scoped. resolveAccountOrganisation turns
 *                                     the code into an id and confirms the
 *                                     caller belongs to that organisation, so
 *                                     handlers never trust a client-supplied id.
 *
 * Order matters: `/organisations` is declared before `/:orgCode/...` so it is
 * not captured as an organisation code.
 */

const router = Router();

/** The `form_submissions.submission_type` values this API will store. */
const SUBMISSION_TYPES = [
  'event_entry',
  'membership_application',
  'calendar_booking',
  'merchandise_order',
  'registration',
] as const;

/**
 * Refuse a basket line the catalogue would not offer.
 *
 * The check belongs to the item type, so this dispatches rather than trying to
 * be general. A type with no case falls through rather than being refused:
 * inventing a rule here would be worse than enforcing none.
 *
 * Throws `ValidationError`, which the route turns into a 400 with the reason.
 */
async function assertAddable(
  organisationId: string,
  organisationUserId: string,
  body: any
): Promise<void> {
  const contextRef = body?.contextRef ?? {};

  switch (body?.itemType) {
    case 'event-entry':
    case 'event_entry': {
      const activity = await accountCatalogueService.assertActivityAvailable(
        organisationId,
        organisationUserId,
        contextRef.activityId
      );
      if (!activity.available) {
        throw new ValidationError('That activity can no longer be entered');
      }
      return;
    }

    case 'merchandise': {
      await accountCatalogueService.assertMerchandiseAvailable(
        organisationId,
        contextRef.merchandiseTypeId,
        Object.values(contextRef.selectedOptions ?? {}) as string[],
        Number(body?.quantity ?? 1)
      );
      return;
    }

    case 'registration': {
      await accountCatalogueService.assertRegistrationTypeAvailable(
        organisationId,
        contextRef.registrationTypeId,
        contextRef.entityName
      );
      return;
    }

    case 'booking': {
      await accountCatalogueService.assertSlotAvailable(
        organisationId,
        contextRef.calendarId,
        contextRef.date,
        contextRef.startTime,
        Number(contextRef.duration),
        Number(contextRef.places ?? 1)
      );
      return;
    }

    default:
      return;
  }
}

/** `YYYY-MM-DD`, and a real date rather than a plausible-looking string. */
function isDateKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (24 * 60 * 60 * 1000)
  );
}

/**
 * @swagger
 * /api/account/organisations:
 *   get:
 *     summary: Organisations this user belongs to
 *     description: >
 *       Backs the organisation switcher. Includes memberships that are pending
 *       or rejected, so the application can explain a state rather than
 *       appearing to have lost an organisation.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: The user's organisations
 */
router.get(
  '/organisations',
  authenticateToken(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organisations = await accountOrganisationService.getOrganisationsForUser(
        req.user!.userId
      );
      return res.json({ organisations });
    } catch (error) {
      logger.error('Error in GET /account/organisations:', error);
      return res.status(500).json({ error: 'Failed to load your organisations' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/me:
 *   get:
 *     summary: The signed-in member's context within one organisation
 *     description: >
 *       Everything the application shell needs to render: the member's own
 *       details, and the organisation's capabilities, currency and language.
 *       A single call so the shell does not have to fan out before it can draw
 *       a menu.
 *     tags: [Account]
 *     parameters:
 *       - in: path
 *         name: orgCode
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Member and organisation context
 *       403:
 *         description: >
 *           Not connected, awaiting approval, rejected, or inactive — the
 *           reason is in error.code
 *       404:
 *         description: Unknown organisation
 */
router.get(
  '/:orgCode/me',
  authenticateToken(),
  resolveAccountOrganisation(),
  async (req: AccountRequest, res: Response) => {
    try {
      const account = req.account!;
      const profile = await accountOrganisationService.getAccountUserProfile(
        account.organisationUserId
      );

      return res.json({
        user: profile,
        organisation: {
          urlCode: account.urlCode,
          displayName: account.displayName,
          currency: account.currency,
          language: account.language,
          capabilities: account.capabilities,
        },
      });
    } catch (error) {
      logger.error('Error in GET /account/:orgCode/me:', error);
      return res.status(500).json({ error: 'Failed to load your details' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/register:
 *   post:
 *     summary: Connect the signed-in identity to an organisation
 *     description: >
 *       Keycloak owns identity creation — this connects an account that already
 *       exists to an organisation, which covers both a newly registered member
 *       and an existing member of another club joining this one. Whether they
 *       land active or pending is the organisation's auto-registration setting.
 *
 *       Deliberately **not** behind resolveAccountOrganisation: the whole point
 *       is that the caller is not yet a member.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: Connected, with the resulting state
 *       404:
 *         description: Unknown organisation
 */
router.post(
  '/:orgCode/register',
  authenticateToken(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organisationId = await accountOrganisationService.getOrganisationIdByCode(
        req.params.orgCode
      );

      if (!organisationId) {
        return res.status(404).json({
          error: { code: 'ORGANISATION_UNAVAILABLE', message: 'Organisation not found' },
        });
      }

      const { firstName, lastName, phone } = req.body ?? {};

      const result = await accountRegistrationService.register(organisationId, {
        keycloakUserId: req.user!.userId,
        // The address comes from the verified token, never from the body — a
        // caller must not be able to register under someone else's email.
        email: req.user!.email,
        firstName,
        lastName,
        phone,
      });

      return res.json(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      logger.error('Error in POST /account/:orgCode/register:', error);
      return res.status(500).json({ error: 'Failed to register with that organisation' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/registration-status:
 *   get:
 *     summary: Where this member stands with an organisation
 *     description: >
 *       Backs the "Check again" button on the awaiting-approval screen (A8), so
 *       an approval that has just landed is picked up without a sign-out and
 *       sign-in. Answers for members who are not active, which is exactly why
 *       it does not use resolveAccountOrganisation.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: One of connected, pending, rejected, inactive or not_connected
 *       404:
 *         description: Unknown organisation
 */
router.get(
  '/:orgCode/registration-status',
  authenticateToken(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await accountOrganisationService.resolveMembership(
        req.user!.userId,
        req.params.orgCode
      );

      if (result.ok) {
        return res.json({ state: 'connected' });
      }

      if (result.reason === 'ORGANISATION_UNAVAILABLE') {
        return res.status(404).json({
          error: { code: result.reason, message: 'Organisation not found' },
        });
      }

      const state = {
        NOT_CONNECTED: 'not_connected',
        PENDING_APPROVAL: 'pending',
        REGISTRATION_REJECTED: 'rejected',
        ACCOUNT_INACTIVE: 'inactive',
      }[result.reason];

      // 200, not 403: this endpoint's job is to *report* the state, so a
      // pending member polling it is asking a legitimate question.
      return res.json({ state });
    } catch (error) {
      logger.error('Error in GET /account/:orgCode/registration-status:', error);
      return res.status(500).json({ error: 'Failed to check your registration' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/cart:
 *   get:
 *     summary: The member's cart, with every figure it needs to display
 *     description: >
 *       Totals are computed server-side and returned whole — the client renders
 *       them and never recomputes. Items whose soft hold has expired are
 *       excluded from the totals and reported in `warnings`.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: Cart contents, totals and warnings
 */
router.get(
  '/:orgCode/cart',
  authenticateToken(),
  resolveAccountOrganisation(),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId, organisationUserId, currency } = req.account!;
      const cart = await cartService.getCart(
        organisationId,
        organisationUserId,
        currency
      );
      return res.json(cart);
    } catch (error) {
      logger.error('Error in GET /account/:orgCode/cart:', error);
      return res.status(500).json({ error: 'Failed to load your cart' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/cart/items:
 *   post:
 *     summary: Add an item to the cart
 *     tags: [Account]
 *     responses:
 *       201:
 *         description: The item as added
 *       400:
 *         description: Invalid item or an unsupported payment method
 */
router.post(
  '/:orgCode/cart/items',
  authenticateToken(),
  resolveAccountOrganisation(),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId, organisationUserId, currency } = req.account!;

      /*
       * Availability is re-checked here, against the same catalogue the member
       * was looking at. `cartService.addItem` trusts its caller by design, so
       * without this a POST could add a closed event, a sold-out size, or ten
       * of something limited to two — none of which the screens offer, and all
       * of which the club would then have to unpick after the money arrived.
       */
      await assertAddable(organisationId, organisationUserId, req.body);

      const item = await cartService.addItem(
        organisationId,
        organisationUserId,
        currency,
        req.body
      );
      return res.status(201).json(item);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      logger.error('Error in POST /account/:orgCode/cart/items:', error);
      return res.status(500).json({ error: 'Failed to add the item to your cart' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/cart/items/{itemId}/payment-method:
 *   put:
 *     summary: Change how one item will be paid for
 *     description: >
 *       Restricted to the methods the source item declared it accepts, captured
 *       when the item entered the cart.
 *     tags: [Account]
 *     responses:
 *       204:
 *         description: Updated
 *       400:
 *         description: That method is not accepted for this item
 *       404:
 *         description: No such item in this member's cart
 */
router.put(
  '/:orgCode/cart/items/:itemId/payment-method',
  authenticateToken(),
  resolveAccountOrganisation(),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId, organisationUserId, currency } = req.account!;
      const { paymentMethodId } = req.body;

      if (!paymentMethodId) {
        return res.status(400).json({ error: 'paymentMethodId is required' });
      }

      // Resolve the member's own cart rather than trusting a cart id, so one
      // member cannot edit another's basket.
      const cart = await cartService.getOrCreateOpenCart(
        organisationId,
        organisationUserId,
        currency
      );
      await cartService.setItemPaymentMethod(
        cart.id,
        req.params.itemId,
        paymentMethodId
      );
      return res.status(204).send();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      logger.error('Error in PUT /account/:orgCode/cart/items/:itemId/payment-method:', error);
      return res.status(500).json({ error: 'Failed to change the payment method' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/cart/items/{itemId}:
 *   delete:
 *     summary: Remove an item from the cart
 *     tags: [Account]
 *     responses:
 *       204:
 *         description: Removed
 *       404:
 *         description: No such item in this member's cart
 */
router.delete(
  '/:orgCode/cart/items/:itemId',
  authenticateToken(),
  resolveAccountOrganisation(),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId, organisationUserId, currency } = req.account!;
      const cart = await cartService.getOrCreateOpenCart(
        organisationId,
        organisationUserId,
        currency
      );
      await cartService.removeItem(cart.id, req.params.itemId);
      return res.status(204).send();
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      logger.error('Error in DELETE /account/:orgCode/cart/items/:itemId:', error);
      return res.status(500).json({ error: 'Failed to remove the item' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/dashboard:
 *   get:
 *     summary: The member's home screen, in one request
 *     description: >
 *       B3. Assembles the membership card, what is coming up, the basket, recent
 *       payments and a few things the club is offering — each section omitted
 *       entirely when the club has not enabled that area, so the screen renders
 *       nothing rather than an empty card. Every figure comes from the service
 *       that owns it; nothing is decided here.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: The dashboard
 */
router.get(
  '/:orgCode/dashboard',
  authenticateToken(),
  resolveAccountOrganisation(),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId, organisationUserId, capabilities, currency } = req.account!;
      return res.json(
        await accountDashboardService.build(
          organisationId,
          organisationUserId,
          capabilities,
          currency
        )
      );
    } catch (error) {
      logger.error('Error in GET /account/:orgCode/dashboard:', error);
      return res.status(500).json({ error: 'Failed to load your home page' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/entries:
 *   get:
 *     summary: The member's own event entries
 *     description: >
 *       Backs C1. Scoped to the caller by `req.account.organisationUserId`,
 *       which the client never supplies — an id in the URL would let one member
 *       read another's entries.
 *     tags: [Account]
 *     parameters:
 *       - in: path
 *         name: orgCode
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The member's entries, newest first
 */
router.get(
  '/:orgCode/entries',
  authenticateToken(),
  resolveAccountOrganisation(),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId, organisationUserId } = req.account!;
      const entries = await accountActivityService.listEntries(
        organisationId,
        organisationUserId
      );
      return res.json(entries);
    } catch (error) {
      logger.error('Error in GET /account/:orgCode/entries:', error);
      return res.status(500).json({ error: 'Failed to load your entries' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/bookings:
 *   get:
 *     summary: The member's own bookings
 *     description: Backs C1's Bookings tab. Scoped exactly as `/entries` is.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: The member's bookings, newest first
 */
router.get(
  '/:orgCode/bookings',
  authenticateToken(),
  resolveAccountOrganisation(),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId, organisationUserId } = req.account!;
      const bookings = await accountActivityService.listBookings(
        organisationId,
        organisationUserId
      );
      return res.json(bookings);
    } catch (error) {
      logger.error('Error in GET /account/:orgCode/bookings:', error);
      return res.status(500).json({ error: 'Failed to load your bookings' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/memberships:
 *   get:
 *     summary: The member's own memberships
 *     description: >
 *       Backs C4, including whether each may be renewed. `renewalNotOpen`
 *       distinguishes "due, but the club has published nothing to renew into"
 *       from "not due", so the screen never offers a button leading nowhere.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: The member's memberships, latest expiry first
 */
router.get(
  '/:orgCode/memberships',
  authenticateToken(),
  resolveAccountOrganisation(),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId, organisationUserId } = req.account!;
      const memberships = await accountActivityService.listMemberships(
        organisationId,
        organisationUserId
      );
      return res.json(memberships);
    } catch (error) {
      logger.error('Error in GET /account/:orgCode/memberships:', error);
      return res.status(500).json({ error: 'Failed to load your memberships' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/entries/{entryId}:
 *   get:
 *     summary: One of the member's entries, in full
 *     description: >
 *       Backs C2. An entry belonging to someone else is reported as not found
 *       rather than forbidden — saying "forbidden" would confirm the id exists.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: The entry
 *       404:
 *         description: No such entry belonging to this member
 */
router.get(
  '/:orgCode/entries/:entryId',
  authenticateToken(),
  resolveAccountOrganisation(),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId, organisationUserId } = req.account!;
      const entry = await accountActivityService.getEntry(
        organisationId,
        organisationUserId,
        req.params.entryId
      );
      return res.json(entry);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          error: { code: 'ENTRY_NOT_FOUND', message: 'Entry not found' },
        });
      }
      logger.error('Error in GET /account/:orgCode/entries/:entryId:', error);
      return res.status(500).json({ error: 'Failed to load your entry' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/checkout:
 *   post:
 *     summary: Turn the member's basket into a payment
 *     description: >
 *       Re-prices the cart server-side and creates a pending payment, returning
 *       what the client needs to complete it. Safe to call more than once for
 *       the same basket — an in-flight payment is reused rather than a second
 *       one created, so a reloaded checkout page does not double-charge.
 *
 *       The order is **not** fulfilled here. That happens when the provider's
 *       webhook confirms the money arrived; fulfilling at checkout would hand
 *       out entries for payments that then fail.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: The payment, and the client secret when a card charge is due
 *       400:
 *         description: The basket is empty, has lapsed holds, or the club cannot take payment
 */
router.post(
  '/:orgCode/checkout',
  authenticateToken(),
  resolveAccountOrganisation(),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId, organisationUserId, currency } = req.account!;
      const result = await checkoutService.startCheckout(
        organisationId,
        organisationUserId,
        currency
      );
      return res.json(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: { code: 'CHECKOUT_REFUSED', message: error.message },
        });
      }
      logger.error('Error in POST /account/:orgCode/checkout:', error);
      return res.status(500).json({ error: 'Failed to start checkout' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/payments/{paymentId}:
 *   get:
 *     summary: The status of one of the member's payments
 *     description: >
 *       Polled by the confirmation screen while the webhook is in flight. The
 *       client learns from Stripe that the card was accepted, but the order is
 *       only complete once the webhook has been processed — so the screen waits
 *       on this rather than on the client-side result.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: The payment's current status
 *       404:
 *         description: No such payment belonging to this member
 */
router.get(
  '/:orgCode/payments/:paymentId',
  authenticateToken(),
  resolveAccountOrganisation(),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId, organisationUserId } = req.account!;
      const status = await checkoutService.getPaymentStatus(
        organisationId,
        organisationUserId,
        req.params.paymentId
      );
      return res.json(status);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          error: { code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' },
        });
      }
      logger.error('Error in GET /account/:orgCode/payments/:paymentId:', error);
      return res.status(500).json({ error: 'Failed to load the payment' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/profile:
 *   get:
 *     summary: The member's own profile
 *     description: >
 *       Name, phone, email and language preference, plus how many organisations
 *       this identity belongs to — the screen warns that edits apply to all of
 *       them. Email is returned read-only; changing it, like changing a
 *       password, goes through Keycloak's account console so the verification
 *       flow is not reimplemented.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: The profile
 */
router.get(
  '/:orgCode/profile',
  authenticateToken(),
  resolveAccountOrganisation(),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationUserId } = req.account!;
      return res.json(await accountProfileService.getProfile(organisationUserId));
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      logger.error('Error in GET /account/:orgCode/profile:', error);
      return res.status(500).json({ error: 'Failed to load the profile' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/profile:
 *   put:
 *     summary: Update the member's own profile
 *     description: >
 *       Writes the name, phone and language to Keycloak and to every
 *       `organization_users` row for that identity — these details belong to
 *       the person, not to one club. Email and password are not accepted here.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: The updated profile
 *       400:
 *         description: The details were rejected
 */
router.put(
  '/:orgCode/profile',
  authenticateToken(),
  resolveAccountOrganisation(),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationUserId } = req.account!;
      const { firstName, lastName, phone, preferredLanguage } = req.body ?? {};

      // Whitelisted rather than passed through: email and status reaching the
      // service from a request body would be a privilege escalation.
      const profile = await accountProfileService.updateProfile(organisationUserId, {
        firstName,
        lastName,
        phone,
        preferredLanguage,
      });

      return res.json(profile);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      logger.error('Error in PUT /account/:orgCode/profile:', error);
      return res.status(500).json({ error: 'Failed to save the profile' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/tickets:
 *   get:
 *     summary: The member's electronic tickets
 *     description: >
 *       Every ticket held by the caller, soonest event first, each with a state
 *       of valid / awaiting-payment / used / expired. Used and expired tickets
 *       are returned rather than hidden: a member whose ticket will not scan
 *       needs to see why.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: The member's tickets
 */
router.get(
  '/:orgCode/tickets',
  authenticateToken(),
  resolveAccountOrganisation(),
  requireAccountCapability('event-ticketing'),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId, organisationUserId } = req.account!;
      const tickets = await accountTicketingService.listTickets(
        organisationId,
        organisationUserId
      );
      return res.json(tickets);
    } catch (error) {
      logger.error('Error in GET /account/:orgCode/tickets:', error);
      return res.status(500).json({ error: 'Failed to load tickets' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/tickets/{ticketId}:
 *   get:
 *     summary: One ticket, with everything needed to render it
 *     description: >
 *       Includes the QR payload and the organisation's ticket configuration, so
 *       the ticket screen renders from a single response and can be cached
 *       whole for offline use at a gate.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: The ticket
 *       404:
 *         description: No such ticket, or it belongs to another member
 */
router.get(
  '/:orgCode/tickets/:ticketId',
  authenticateToken(),
  resolveAccountOrganisation(),
  requireAccountCapability('event-ticketing'),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId, organisationUserId } = req.account!;
      const ticket = await accountTicketingService.getTicket(
        organisationId,
        organisationUserId,
        req.params.ticketId
      );

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      return res.json(ticket);
    } catch (error) {
      logger.error('Error in GET /account/:orgCode/tickets/:ticketId:', error);
      return res.status(500).json({ error: 'Failed to load the ticket' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/catalogue/events:
 *   get:
 *     summary: Events this member can enter
 *     description: >
 *       Published, not-yet-finished events with their activities. Availability
 *       is decided on the server and returned as an explicit reason rather than
 *       by omitting rows — a member looking for an event they know exists is
 *       better served by "entries closed on 1 June" than by an empty list.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: The events, each with its activities and availability
 */
router.get(
  '/:orgCode/catalogue/events',
  authenticateToken(),
  resolveAccountOrganisation(),
  requireAccountCapability('event-management'),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId, organisationUserId } = req.account!;
      const events = await accountCatalogueService.listEvents(organisationId, organisationUserId);
      return res.json(events);
    } catch (error) {
      logger.error('Error in GET /account/:orgCode/catalogue/events:', error);
      return res.status(500).json({ error: 'Failed to load events' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/catalogue/membership-types:
 *   get:
 *     summary: Membership types this member can apply for
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: The membership types, with availability
 */
router.get(
  '/:orgCode/catalogue/membership-types',
  authenticateToken(),
  resolveAccountOrganisation(),
  requireAccountCapability('memberships'),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId, organisationUserId } = req.account!;
      const types = await accountCatalogueService.listMembershipTypes(
        organisationId,
        organisationUserId
      );
      return res.json(types);
    } catch (error) {
      logger.error('Error in GET /account/:orgCode/catalogue/membership-types:', error);
      return res.status(500).json({ error: 'Failed to load membership types' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/catalogue/merchandise:
 *   get:
 *     summary: What the club sells
 *     description: >
 *       Active merchandise with its option types and values, quantity rules,
 *       delivery rule and availability. Sold-out items are returned with a
 *       reason unless the club has chosen to hide them; prices are minor units,
 *       and the price of an item is the sum of the option values chosen.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: The items, each with its options and availability
 */
router.get(
  '/:orgCode/catalogue/merchandise',
  authenticateToken(),
  resolveAccountOrganisation(),
  requireAccountCapability('merchandise'),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId } = req.account!;
      const items = await accountCatalogueService.listMerchandise(organisationId);
      return res.json(items);
    } catch (error) {
      logger.error('Error in GET /account/:orgCode/catalogue/merchandise:', error);
      return res.status(500).json({ error: 'Failed to load the shop' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/bookings/{bookingId}/cancel:
 *   post:
 *     summary: Cancel one of this member's own bookings
 *     description: >
 *       Subject to the club's policy — whether members may cancel, and how much
 *       notice is required — which is re-checked here rather than trusted from
 *       the screen. No money moves: the response says whether the club's policy
 *       means a refund is due, and the refund itself stays an act of the club.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: Cancelled, with whether a refund should be expected
 *       400:
 *         description: The club's policy does not allow it — the reason is in error
 *       404:
 *         description: No such booking for this member in this organisation
 */
router.post(
  '/:orgCode/bookings/:bookingId/cancel',
  authenticateToken(),
  resolveAccountOrganisation(),
  requireAccountCapability('calendar-bookings'),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId, organisationUserId } = req.account!;
      return res.json(
        await accountActivityService.cancelBooking(
          organisationId,
          organisationUserId,
          req.params.bookingId
        )
      );
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: error.message } });
      }
      logger.error('Error in POST /account/:orgCode/bookings/:bookingId/cancel:', error);
      return res.status(500).json({ error: 'Failed to cancel your booking' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/payments:
 *   get:
 *     summary: What this member has paid
 *     description: >
 *       The member's own payments, newest first, each with its lines — what was
 *       bought, what it cost, and whether it was fulfilled. Not
 *       capability-gated: a payment can cover items from any area, and a member
 *       has a right to their own receipts whatever the club has since switched
 *       off.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: The payments
 */
router.get(
  '/:orgCode/payments',
  authenticateToken(),
  resolveAccountOrganisation(),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId, organisationUserId } = req.account!;
      return res.json(
        await accountActivityService.listPayments(organisationId, organisationUserId)
      );
    } catch (error) {
      logger.error('Error in GET /account/:orgCode/payments:', error);
      return res.status(500).json({ error: 'Failed to load your payments' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/catalogue/registration-types:
 *   get:
 *     summary: What a member can register something for
 *     description: >
 *       Registration schemes open to members — a horse, a boat, a dog. Each
 *       carries the club's word for the thing being registered (`entityName`),
 *       which the screens use verbatim, and whether the club reviews the
 *       registration before it takes effect.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: The registration types, with availability
 */
router.get(
  '/:orgCode/catalogue/registration-types',
  authenticateToken(),
  resolveAccountOrganisation(),
  requireAccountCapability('registrations'),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId } = req.account!;
      return res.json(await accountCatalogueService.listRegistrationTypes(organisationId));
    } catch (error) {
      logger.error('Error in GET /account/:orgCode/catalogue/registration-types:', error);
      return res.status(500).json({ error: 'Failed to load registrations' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/registrations:
 *   get:
 *     summary: What this member has registered
 *     description: >
 *       The member's own registrations, newest first, each with the club's word
 *       for what was registered and its name. Scoped to the member and the
 *       organisation from the session.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: The registrations
 */
router.get(
  '/:orgCode/registrations',
  authenticateToken(),
  resolveAccountOrganisation(),
  requireAccountCapability('registrations'),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId, organisationUserId } = req.account!;
      return res.json(
        await accountActivityService.listRegistrations(organisationId, organisationUserId)
      );
    } catch (error) {
      logger.error('Error in GET /account/:orgCode/registrations:', error);
      return res.status(500).json({ error: 'Failed to load your registrations' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/catalogue/calendars:
 *   get:
 *     summary: Resources this member can book
 *     description: >
 *       The club's calendars and their booking rules — notice period, how far
 *       ahead bookings are taken, cancellation policy and terms. Availability is
 *       per calendar and per date range, so it is not returned here.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: The calendars
 */
router.get(
  '/:orgCode/catalogue/calendars',
  authenticateToken(),
  resolveAccountOrganisation(),
  requireAccountCapability('calendar-bookings'),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId } = req.account!;
      return res.json(await accountCatalogueService.listCalendars(organisationId));
    } catch (error) {
      logger.error('Error in GET /account/:orgCode/catalogue/calendars:', error);
      return res.status(500).json({ error: 'Failed to load the calendars' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/catalogue/calendars/{calendarId}/availability:
 *   get:
 *     summary: What is free on a calendar between two dates
 *     description: >
 *       Availability is derived, never stored: the schedule, blocked periods,
 *       confirmed bookings and live holds are subtracted server-side. Slots that
 *       are taken come back with a reason rather than being omitted, so a member
 *       can see the difference between a busy day and a closed one.
 *     tags: [Account]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: The calendar and its slots
 *       400:
 *         description: The range is missing, malformed or too long
 *       404:
 *         description: No such calendar in this organisation
 */
router.get(
  '/:orgCode/catalogue/calendars/:calendarId/availability',
  authenticateToken(),
  resolveAccountOrganisation(),
  requireAccountCapability('calendar-bookings'),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId } = req.account!;
      const { from, to } = req.query as { from?: string; to?: string };

      if (!isDateKey(from) || !isDateKey(to)) {
        return res.status(400).json({ error: 'from and to must be YYYY-MM-DD dates' });
      }
      if (to! < from!) {
        return res.status(400).json({ error: 'to must not be before from' });
      }
      /*
       * A bound, because the work is proportional to the range: every slot on
       * every configuration for every day. Two months covers the widest view
       * the screens offer with room to spare.
       */
      if (daysBetween(from!, to!) > 62) {
        return res.status(400).json({ error: 'Ask for at most 62 days at a time' });
      }

      return res.json(
        await accountCatalogueService.listCalendarAvailability(
          organisationId,
          req.params.calendarId,
          from!,
          to!
        )
      );
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: error.message } });
      }
      logger.error('Error in GET /account/:orgCode/catalogue/calendars/:id/availability:', error);
      return res.status(500).json({ error: 'Failed to load availability' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/orders:
 *   get:
 *     summary: Merchandise this member has ordered
 *     description: >
 *       The member's own orders, newest first, with the options resolved to
 *       their names. Scoped to the member and the organisation from the
 *       session, never from the request.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: The orders
 */
router.get(
  '/:orgCode/orders',
  authenticateToken(),
  resolveAccountOrganisation(),
  requireAccountCapability('merchandise'),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId, organisationUserId } = req.account!;
      const orders = await accountActivityService.listMerchandiseOrders(
        organisationId,
        organisationUserId
      );
      return res.json(orders);
    } catch (error) {
      logger.error('Error in GET /account/:orgCode/orders:', error);
      return res.status(500).json({ error: 'Failed to load your orders' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/forms/{formId}:
 *   get:
 *     summary: An application form the member has to complete
 *     description: >
 *       The form definition for an activity or membership type, so the member
 *       can answer it before adding the item to their basket. Scoped to the
 *       organisation — a form id from another club is reported as not found
 *       rather than served.
 *     tags: [Account]
 *     responses:
 *       200:
 *         description: The form and its fields
 *       404:
 *         description: No such form in this organisation
 */
router.get(
  '/:orgCode/forms/:formId',
  authenticateToken(),
  resolveAccountOrganisation(),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId } = req.account!;
      const form = await applicationFormService.getApplicationFormWithFields(req.params.formId);

      /*
       * The service looks a form up by id alone, so the organisation check
       * happens here. Without it a member could read any club's form by
       * guessing an id.
       */
      if (!form || form.organisationId !== organisationId) {
        return res.status(404).json({
          error: { code: 'FORM_NOT_FOUND', message: 'Form not found' },
        });
      }

      return res.json(form);
    } catch (error) {
      logger.error('Error in GET /account/:orgCode/forms/:formId:', error);
      return res.status(500).json({ error: 'Failed to load the form' });
    }
  }
);

/**
 * @swagger
 * /api/account/{orgCode}/form-submissions:
 *   post:
 *     summary: Record the member's answers to an application form
 *     description: >
 *       Creates the submission that a basket line then references. Returns its
 *       id, which the client passes to `POST /cart/items` as
 *       `formSubmissionId` — that is what makes the item fulfillable, since a
 *       membership cannot be created without one.
 *
 *       The submission is attributed to the signed-in member, never to a user
 *       id supplied by the caller.
 *     tags: [Account]
 *     responses:
 *       201:
 *         description: The created submission
 *       400:
 *         description: Missing form, context or answers
 *       404:
 *         description: No such form in this organisation
 */
router.post(
  '/:orgCode/form-submissions',
  authenticateToken(),
  resolveAccountOrganisation(),
  async (req: AccountRequest, res: Response) => {
    try {
      const { organisationId, organisationUserId } = req.account!;
      const { formId, contextId, submissionType, submissionData } = req.body ?? {};

      if (!formId || !contextId || !submissionData) {
        return res.status(400).json({
          error: 'formId, contextId and submissionData are required',
        });
      }

      const form = await applicationFormService.getApplicationFormWithFields(formId);
      if (!form || form.organisationId !== organisationId) {
        return res.status(404).json({
          error: { code: 'FORM_NOT_FOUND', message: 'Form not found' },
        });
      }

      /*
       * The answers are checked against the form's own fields before they are
       * stored. The client checks first and names the field, but this endpoint
       * is a plain authenticated POST and a submission is what a membership or
       * an entry is built from afterwards — an unvalidated one is a bad record,
       * not a bad screen.
       */
      const fieldErrors = validateSubmissionData(form.fields as any, submissionData);
      if (fieldErrors.length > 0) {
        return res.status(400).json({
          error: {
            code: 'INVALID_SUBMISSION',
            message: 'Some answers need correcting',
            fields: fieldErrors,
          },
        });
      }

      const submission = await formSubmissionService.createSubmission({
        formId,
        organisationId,
        // From the resolved session, never from the request body.
        userId: organisationUserId,
        /*
         * The stored vocabulary, not the basket's item-type names, and an
         * allow-list rather than a pass-through: `submission_type` is a plain
         * varchar, so an unrecognised value would be stored happily and then
         * never match anything that reads by type.
         */
        submissionType: SUBMISSION_TYPES.includes(submissionType)
          ? submissionType
          : 'event_entry',
        contextId,
        submissionData,
      });

      return res.status(201).json(submission);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      logger.error('Error in POST /account/:orgCode/form-submissions:', error);
      return res.status(500).json({ error: 'Failed to save your answers' });
    }
  }
);

export default router;
