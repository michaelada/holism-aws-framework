import React from 'react';
import SvgIcon, { SvgIconProps } from '@mui/material/SvgIcon';
import SportsTennisIcon from '@mui/icons-material/SportsTennis';
import SportsBasketballIcon from '@mui/icons-material/SportsBasketball';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import GolfCourseIcon from '@mui/icons-material/GolfCourse';
import SportsCricketIcon from '@mui/icons-material/SportsCricket';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import PoolIcon from '@mui/icons-material/Pool';
import SailingIcon from '@mui/icons-material/Sailing';
import BedroomBabyIcon from '@mui/icons-material/BedroomBaby';
import HikingIcon from '@mui/icons-material/Hiking';
import ParkIcon from '@mui/icons-material/Park';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import GroupsIcon from '@mui/icons-material/Groups';
import SchoolIcon from '@mui/icons-material/School';
import EventIcon from '@mui/icons-material/Event';
import PlaceIcon from '@mui/icons-material/Place';
import { CalendarIconKey, isCalendarIconKey } from './calendarIcons';

/**
 * Imported individually rather than through the barrel: `@mui/icons-material`
 * re-exports the whole library, and a bundler that cannot tree-shake it pulls
 * two thousand components in to render one.
 */
const ICONS: Record<CalendarIconKey, typeof SvgIcon> = {
  tennis: SportsTennisIcon,
  basketball: SportsBasketballIcon,
  football: SportsSoccerIcon,
  golf: GolfCourseIcon,
  cricket: SportsCricketIcon,
  athletics: DirectionsRunIcon,
  pool: PoolIcon,
  sailing: SailingIcon,
  // The nearest thing the set has to a stable; the equestrian icons are not in
  // the free Material set.
  equestrian: BedroomBabyIcon,
  hiking: HikingIcon,
  park: ParkIcon,
  clubhouse: HomeWorkIcon,
  meetingRoom: MeetingRoomIcon,
  restaurant: RestaurantIcon,
  gym: FitnessCenterIcon,
  calendar: CalendarMonthIcon,
  group: GroupsIcon,
  lesson: SchoolIcon,
  event: EventIcon,
  place: PlaceIcon,
};

export interface CalendarIconProps
  // `name` is omitted from the passthrough set because SVG elements already
  // have one; here it names the icon rather than the element.
  extends Omit<SvgIconProps, 'color' | 'children' | 'name'> {
  /** A stored icon key. Anything unrecognised falls back to the calendar mark. */
  name?: string | null;
  /** The calendar's own colour; inherits when absent. */
  colour?: string | null;
}

/**
 * A calendar's chosen icon, drawn in the calendar's colour.
 *
 * **Falls back rather than disappearing.** A club that never chose an icon, and
 * one whose stored icon this build no longer ships, both get the generic
 * calendar mark — a card with a hole where its icon should be reads as a fault
 * in the club's own setup.
 *
 * The colour is applied here rather than left to the caller so that the icon
 * and the calendar agree wherever it is drawn.
 */
export const CalendarIcon: React.FC<CalendarIconProps> = ({ name, colour, sx, ...props }) => {
  const Icon = isCalendarIconKey(name) ? ICONS[name] : CalendarMonthIcon;

  return <Icon {...props} sx={{ color: colour || undefined, ...sx }} />;
};

export default CalendarIcon;
