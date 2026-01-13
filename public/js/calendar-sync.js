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
    
    // Outlook expects ISO 8601 format: YYYY-MM-DDTHH:MM:SS
    // For all-day events, use 00:00:00 start and 23:59:59 end
    const startDate = `${booking.date}T00:00:00`;
    const endDate = `${booking.date}T23:59:59`;
    
    // Use the Office 365 calendar path which works more reliably
    const url = `https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${title}&body=${body}&location=${locationName}&startdt=${startDate}&enddt=${endDate}`;
    
    window.open(url, '_blank');
}

/**
 * Download ICS file for a booking
 */
export function downloadICS(bookingId) {
    window.location.href = `/api/bookings/${bookingId}/ics`;
}

