/**
 * Calendar Sync
 * Integration with Google Calendar, Outlook, and ICS downloads
 */

import { state } from './state.js';

/**
 * Add booking to Google Calendar
 */
export function addToGoogleCalendar(bookingId) {
    const booking = state.bookings.find(b => b.id === bookingId);
    if (!booking) return;
    
    const team = state.teams.find(t => t.id === booking.teamId);
    const location = state.locations.find(l => l.id === booking.locationId);
    
    const title = encodeURIComponent(`${booking.teamName} - Office Booking`);
    const details = encodeURIComponent(`Team: ${booking.teamName}\nPeople: ${booking.peopleCount}\nManager: ${team?.manager || 'N/A'}`);
    const locationName = encodeURIComponent(location?.name || 'Office');
    const date = booking.date.replace(/-/g, '');
    
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${date}/${date}&details=${details}&location=${locationName}`;
    
    window.open(url, '_blank');
}

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
    
    const startDate = booking.date;
    const endDate = booking.date;
    
    const url = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&body=${body}&location=${locationName}&startdt=${startDate}&enddt=${endDate}&allday=true`;
    
    window.open(url, '_blank');
}

/**
 * Download ICS file for a booking
 */
export function downloadICS(bookingId) {
    window.location.href = `/api/bookings/${bookingId}/ics`;
}

