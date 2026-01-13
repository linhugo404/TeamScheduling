/**
 * Calendar Sync
 * Integration with Outlook Calendar and ICS downloads
 */

import { state } from './state.js';

/**
 * Add booking to Outlook Calendar
 */
export function addToOutlookCalendar(bookingId) {
    const booking = state.bookings.find(b => b.id === bookingId);
    if (!booking) return;
    
    const team = state.teams.find(t => t.id === booking.teamId);
    const location = state.locations.find(l => l.id === booking.locationId);
    
    const title = encodeURIComponent(`${booking.teamName} - Office Booking`);
    const body = encodeURIComponent(`Team: ${booking.teamName}\nPeople: ${booking.peopleCount}\nManager: ${team?.manager || 'N/A'}`);
    const locationName = encodeURIComponent(location?.name || 'Office');
    
    // For all-day events in Outlook, the end date should be the next day at 00:00:00
    const date = new Date(booking.date);
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);
    
    const startDate = `${booking.date}T00:00:00`;
    const endDate = `${nextDay.toISOString().split('T')[0]}T00:00:00`;
    
    // Use the Office 365 calendar path with allday parameter
    const url = `https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${title}&body=${body}&location=${locationName}&startdt=${startDate}&enddt=${endDate}&allday=true`;
    
    window.open(url, '_blank');
}

/**
 * Download ICS file for a booking
 */
export function downloadICS(bookingId) {
    window.location.href = `/api/bookings/${bookingId}/ics`;
}

