import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  EventDateTile,
  formatCurrency,
  formatDisplayDate,
} from '@aws-web-framework/components';
import { useAccountApi } from '../hooks/useAccountApi';
import EntryStatus from '../components/EntryStatus';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import {
  CatalogueActivity,
  CatalogueEvent,
  CatalogueMembershipType,
} from '../types/account';

type TabKey = 'events' | 'memberships';

/**
 * D1 / D4 — what a member can enter or join.
 *
 * Availability comes from the server, and unavailable things are **shown with
 * their reason** rather than hidden. A member looking for an event they know
 * exists is better served by "entries closed on 1 June" than by an empty list,
 * and hiding a full activity invites an email asking where it went.
 *
 * Adding to the basket re-checks availability server-side, so the buttons here
 * are a convenience, not the control.
 */
export interface BrowsePageProps {
  /**
   * Which catalogue this page is.
   *
   * Was a tab inside a single "Enter or join" screen. Two routes instead, so
   * each has its own menu entry, its own title, and can be hidden outright when
   * the club lacks the capability — a tab strip cannot be capability-gated
   * without leaving a page whose only content is a tab that is not there.
   */
  section: 'events' | 'memberships';
}

export const BrowsePage: React.FC<BrowsePageProps> = ({ section }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { orgCode, me, hasCapability } = useAccountOrganisation();

  const { execute: executeEvents } = useAccountApi<CatalogueEvent[]>();
  const { execute: executeTypes } = useAccountApi<CatalogueMembershipType[]>();
  const { execute: executeAdd } = useAccountApi<unknown>();

  const showEvents = hasCapability('event-management');
  const showMemberships = hasCapability('memberships');

  const [events, setEvents] = useState<CatalogueEvent[]>([]);
  const [types, setTypes] = useState<CatalogueMembershipType[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const tab: TabKey = section;

  const currency = me?.organisation.currency;
  const locale = i18n.language;

  const load = useCallback(async () => {
    if (!orgCode) return;
    setLoading(true);
    setFailed(false);

    const requests: Promise<unknown>[] = [];
    if (showEvents) {
      requests.push(
        executeEvents({ url: `/api/account/${orgCode}/catalogue/events` }).then(setEvents)
      );
    }
    if (showMemberships) {
      requests.push(
        executeTypes({ url: `/api/account/${orgCode}/catalogue/membership-types` }).then(setTypes)
      );
    }

    try {
      await Promise.all(requests);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [orgCode, showEvents, showMemberships, executeEvents, executeTypes]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Add straight away, or send the member to the entry page first.
   *
   * Anything with an application form **or** terms to agree to goes to its own
   * page: a long form does not belong in a dialog, and terms a member is about
   * to accept have to be readable rather than crammed behind an overlay.
   *
   * Items with neither keep the one-click add. Routing those through a page
   * whose only content is a confirm button would be ceremony, not consent.
   */
  const requestAdd = (
    key: string,
    body: Record<string, unknown>,
    entry: {
      formId: string | null;
      termsAndConditions: string | null;
      itemId: string;
      kind: 'event' | 'membership';
    }
  ) => {
    if (entry.formId || entry.termsAndConditions) {
      navigate(
        entry.kind === 'event'
          ? `/${orgCode}/browse/events/${entry.itemId}/enter`
          : `/${orgCode}/browse/memberships/${entry.itemId}/apply`
      );
      return;
    }
    void addToBasket(key, body);
  };

  const addToBasket = async (
    key: string,
    body: Record<string, unknown>
  ) => {
    if (!orgCode) return;
    setAdding(key);
    setAddError(null);
    setAdded(null);
    try {
      await executeAdd({
        method: 'POST',
        url: `/api/account/${orgCode}/cart/items`,
        data: body,
      });
      setAdded(key);
      // The catalogue is re-read because adding may have taken the last place,
      // and the member should see that immediately rather than on next visit.
      await load();
    } catch {
      setAddError(t('browse.addFailed'));
    } finally {
      setAdding(null);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="h1" gutterBottom>
        {section === 'events' ? t('browse.eventsTitle') : t('browse.membershipsTitle')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {section === 'events' ? t('browse.eventsSubtitle') : t('browse.membershipsSubtitle')}
      </Typography>

      {failed && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('browse.loadError')}
        </Alert>
      )}
      {addError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setAddError(null)}>
          {addError}
        </Alert>
      )}
      {added && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setAdded(null)}>
          {t('browse.addedToBasket')}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label={t('common.loading')} />
        </Box>
      ) : tab === 'events' ? (
        events.length === 0 ? (
          !failed && <Typography sx={{ py: 4 }}>{t('browse.noEvents')}</Typography>
        ) : (
          events.map((event) => (
            <Accordion key={event.id} defaultExpanded={event.available}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                {/*
                  The date leads: an events list is scanned for *when*, and a
                  tile is read at a glance where another line of prose has to be
                  parsed row by row.
                */}
                <EventDateTile
                  date={event.startDate}
                  endDate={event.endDate}
                  locale={locale}
                  size="small"
                />

                <Box sx={{ flexGrow: 1, minWidth: 0, ml: 2 }}>
                  <Typography fontWeight={600} gutterBottom>
                    {event.name}
                  </Typography>

                  {/*
                    Window and capacity together. `EntryStatus` suppresses the
                    places count when the window is shut, so a closed event
                    never advertises places a member cannot take.
                  */}
                  <EntryStatus event={event} />
                </Box>

                {/*
                  The server's own refusal, kept alongside: it is the
                  authoritative answer, and covers reasons the dates do not
                  explain — already entered, event full.
                */}
                {!event.available && event.unavailableReason !== 'entries-not-open' &&
                  event.unavailableReason !== 'entries-closed' && (
                    <Chip
                      size="small"
                      color="default"
                      sx={{ alignSelf: 'center' }}
                      label={t(`browse.reason.${event.unavailableReason}`, {
                        date: formatDisplayDate(event.entriesClosingDate, locale),
                        defaultValue: t('browse.reason.unavailable'),
                      })}
                    />
                  )}
              </AccordionSummary>
              <AccordionDetails>
                {event.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {event.description}
                  </Typography>
                )}
                {event.activities.length === 0 ? (
                  <Typography variant="body2">{t('browse.noActivities')}</Typography>
                ) : (
                  <Stack divider={<Divider />} spacing={1}>
                    {event.activities.map((activity) => (
                      <ActivityRow
                        key={activity.id}
                        activity={activity}
                        currency={currency}
                        locale={locale}
                        busy={adding === activity.id}
                        onAdd={() =>
                          requestAdd(
                            activity.id,
                            {
                              itemType: 'event-entry',
                              contextRef: { activityId: activity.id, eventId: event.id },
                              description: `${event.name} — ${activity.name}`,
                              unitFee: activity.fee,
                              handlingFeeIncluded: activity.handlingFeeIncluded,
                              supportedPaymentMethodIds: activity.supportedPaymentMethodIds,
                            },
                            {
                              formId: activity.applicationFormId,
                              termsAndConditions: activity.termsAndConditions,
                              itemId: activity.id,
                              kind: 'event',
                            }
                          )
                        }
                      />
                    ))}
                  </Stack>
                )}
              </AccordionDetails>
            </Accordion>
          ))
        )
      ) : types.length === 0 ? (
        !failed && <Typography sx={{ py: 4 }}>{t('browse.noMembershipTypes')}</Typography>
      ) : (
        <Grid container spacing={2}>
          {types.map((type) => (
            <Grid item xs={12} md={6} key={type.id}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {type.name}
                  </Typography>
                  {type.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {type.description}
                    </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    {formatCurrency(type.fee / 100, currency, locale)}
                  </Typography>
                  {type.validUntil && (
                    <Typography variant="body2" color="text.secondary">
                      {t('memberships.validUntil')}:{' '}
                      {formatDisplayDate(type.validUntil, locale)}
                    </Typography>
                  )}
                  {/*
                    The member already holds this and it is nearly up. Saying so
                    is what stops "Apply" reading as a mistake to somebody who
                    knows they are already a member.
                  */}
                  {type.isRenewal && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {t('browse.renewalNote')}
                    </Typography>
                  )}

                  <Box sx={{ mt: 2 }}>
                    {type.available ? (
                      <Button
                        variant="contained"
                        disabled={adding === type.id}
                        onClick={() =>
                          requestAdd(
                            type.id,
                            {
                              itemType: 'membership',
                              contextRef: { membershipTypeId: type.id },
                              description: type.name,
                              // The price is a property of the membership type.
                              // An earlier version added these lines at zero on
                              // the assumption that pricing lived on the
                              // application form — it does not, and every
                              // membership was therefore free.
                              unitFee: type.fee,
                              handlingFeeIncluded: type.handlingFeeIncluded,
                              supportedPaymentMethodIds: type.supportedPaymentMethodIds,
                            },
                            {
                              formId: type.membershipFormId,
                              termsAndConditions: type.termsAndConditions,
                              itemId: type.id,
                              kind: 'membership',
                            }
                          )
                        }
                      >
                        {type.isRenewal ? t('browse.renew') : t('browse.apply')}
                      </Button>
                    ) : (
                      <Chip
                        size="small"
                        label={t(`browse.reason.${type.unavailableReason}`, {
                          defaultValue: t('browse.reason.unavailable'),
                        })}
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

const ActivityRow: React.FC<{
  activity: CatalogueActivity;
  currency?: string;
  locale: string;
  busy: boolean;
  onAdd: () => void;
}> = ({ activity, currency, locale, busy, onAdd }) => {
  const { t } = useTranslation();

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      sx={{ py: 1 }}
    >
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography>{activity.name}</Typography>
        <Typography variant="body2" color="text.secondary">
          {formatCurrency(activity.fee / 100, currency, locale)}
          {/*
            Only shown when the cap is close enough to matter. "47 places left"
            is noise; "2 places left" is the reason someone acts now.
          */}
          {activity.placesRemaining !== null && activity.placesRemaining <= 10 && (
            <>
              {' · '}
              {t('browse.placesRemaining', { count: activity.placesRemaining })}
            </>
          )}
        </Typography>
      </Box>

      {activity.available ? (
        <Button variant="outlined" size="small" disabled={busy} onClick={onAdd}>
          {t('browse.addToBasket')}
        </Button>
      ) : (
        <Chip
          size="small"
          label={t(`browse.reason.${activity.unavailableReason}`, {
            defaultValue: t('browse.reason.unavailable'),
          })}
        />
      )}
    </Stack>
  );
};

export default BrowsePage;
