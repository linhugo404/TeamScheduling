/**
 * Drag & Drop Functionality
 * Handles dragging bookings between calendar days
 */

import { state } from './state.js';
import { formatDisplayDate, showToast } from './utils.js';
import { updateBooking, invalidateBookingsCache, loadBookingsForMonth } from './api.js';
import { renderCalendar } from './calendar.js';

// Currently dragging booking ID
let draggedBookingId = null;

/**
 * Handle drag start event
 */
export function handleDragStart(event, bookingId) {
    draggedBookingId = bookingId;
    event.target.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', bookingId);
}

/**
 * Handle drag end event
 */
export function handleDragEnd(event) {
    event.target.classList.remove('dragging');
    draggedBookingId = null;
    
    // Remove all drag-over states
    document.querySelectorAll('.calendar-day.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });
}

/**
 * Handle drag over event (allow drop)
 */
export function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    
    const target = event.currentTarget;
    if (!target.classList.contains('drag-over')) {
        target.classList.add('drag-over');
    }
}

/**
 * Handle drag leave event
 */
export function handleDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
}

/**
 * Handle drop event - move booking to new date
 */
export async function handleDrop(event, targetDate) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    
    const bookingId = event.dataTransfer.getData('text/plain') || draggedBookingId;
    if (!bookingId) return;
    
    const booking = state.bookings.find(b => b.id === bookingId);
    if (!booking) return;
    
    // Don't do anything if dropped on same date
    if (booking.date === targetDate) return;
    
    // Check if team already has a booking on target date
    const existingBooking = state.bookings.find(
        b => b.date === targetDate && b.teamId === booking.teamId && b.id !== bookingId
    );
    
    if (existingBooking) {
        showToast(`${booking.teamName} already has a booking on ${formatDisplayDate(targetDate)}`, 'error');
        return;
    }
    
    // Store original date for rollback
    const originalDate = booking.date;
    
    // Optimistic update - immediately move to new date
    const idx = state.bookings.findIndex(b => b.id === bookingId);
    if (idx !== -1) {
        state.bookings[idx].date = targetDate;
        state.bookings[idx]._isLoading = true; // Mark as loading
    }
    
    // Re-render immediately with loading state
    renderCalendar();
    window.updateCapacityDisplay?.();
    
    try {
        await updateBooking(bookingId, { date: targetDate });
        
        // Remove loading state
        if (idx !== -1) {
            delete state.bookings[idx]._isLoading;
        }
        
        invalidateBookingsCache();
        renderCalendar();
        
        showToast(`Moved booking to ${formatDisplayDate(targetDate)}`);
        
    } catch (error) {
        // Rollback on error
        if (idx !== -1) {
            state.bookings[idx].date = originalDate;
            delete state.bookings[idx]._isLoading;
        }
        
        renderCalendar();
        window.updateCapacityDisplay?.();
        
        showToast(error.message || 'Failed to move booking', 'error');
    }
}

// Export for global access
export { draggedBookingId };

