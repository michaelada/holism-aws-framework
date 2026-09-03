import React from 'react';
import { Box } from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import { CalendarIcon } from '@itsplainsailing/components';
import { CartItemType } from '../types/account';

/**
 * What each kind of basket line is drawn as when it has no mark of its own.
 *
 * A booking is the exception: its club chose an icon and a colour for that
 * calendar, and a court, an arena and a clubhouse are meant to be told apart.
 * Everything else takes the icon for its type, because one event entry is not
 * visually distinct from another and pretending otherwise would be noise.
 */
const BY_TYPE: Record<CartItemType, typeof EventIcon> = {
  event_entry: EventIcon,
  membership: CardMembershipIcon,
  registration: HowToRegIcon,
  merchandise: ShoppingBagIcon,
  // Only reached when a booking's calendar has been deleted; `CalendarIcon`
  // handles the ordinary case and its own fallback.
  booking: EventIcon,
};

/**
 * The mark beside a basket line.
 *
 * Drawn as a tinted square in the item's own colour, the same treatment the
 * home screen gives its cards — a basket is where a member checks they picked
 * the right things, and it should look like the screens they picked them from.
 */
export const CartItemIcon: React.FC<{
  itemType: CartItemType;
  /** A calendar's icon key; bookings only. */
  icon?: string | null;
  /** A calendar's colour; falls back to the theme's primary. */
  colour?: string | null;
}> = ({ itemType, icon, colour }) => {
  const Fallback = BY_TYPE[itemType] ?? EventIcon;

  return (
    <Box
      aria-hidden
      sx={{
        width: 40,
        height: 40,
        flexShrink: 0,
        borderRadius: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colour ? `${colour}1f` : 'action.hover',
      }}
    >
      {itemType === 'booking' ? (
        <CalendarIcon name={icon} colour={colour} fontSize="small" />
      ) : (
        <Fallback fontSize="small" color="primary" />
      )}
    </Box>
  );
};

export default CartItemIcon;
