// Mock module for @aws-web-framework/orgadmin-calendar
// Used in tests when the actual package is not built

export const calendarModule = {
  id: 'calendar',
  name: 'modules.calendar.name',
  title: 'modules.calendar.title',
  description: 'modules.calendar.description',
  capability: 'calendar-bookings',
  order: 13,
  card: { 
    title: 'modules.calendar.title', 
    description: 'modules.calendar.description', 
    icon: () => null, 
    path: '/calendar' 
  },
  routes: [{ path: '/calendar', component: () => null }],
};
