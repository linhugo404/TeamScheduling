/**
 * Date Utilities
 * Timezone-aware date handling for the Office Booking System
 * 
 * Key principle: Always work with local dates for bookings
 * Dates are stored as YYYY-MM-DD strings which are timezone-agnostic
 */

/**
 * Get today's date as a YYYY-MM-DD string in local timezone
 * This is the correct way to get "today" regardless of timezone
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function getLocalToday() {
    const now = new Date();
    return formatLocalDate(now);
}

/**
 * Format a Date object to YYYY-MM-DD string in local timezone
 * Avoids issues with toISOString() which converts to UTC
 * @param {Date} date - Date object
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string to a Date object in local timezone
 * Creates the date at midnight local time (not UTC)
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Date} Date object
 */
export function parseLocalDate(dateStr) {
    // Using 'T00:00:00' without 'Z' creates local time
    // This avoids the timezone shift that happens with Date.parse()
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

/**
 * Check if a date string is today in local timezone
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {boolean}
 */
export function isToday(dateStr) {
    return dateStr === getLocalToday();
}

/**
 * Check if a date string is in the past (before today)
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {boolean}
 */
export function isPast(dateStr) {
    return dateStr < getLocalToday();
}

/**
 * Check if a date string is in the future (after today)
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {boolean}
 */
export function isFuture(dateStr) {
    return dateStr > getLocalToday();
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 * @param {string|Date} date - Date string or Date object
 * @returns {boolean}
 */
export function isWeekend(date) {
    const d = typeof date === 'string' ? parseLocalDate(date) : date;
    const day = d.getDay();
    return day === 0 || day === 6;
}

/**
 * Get the first day of a month
 * @param {number} year - Year
 * @param {number} month - Month (0-11)
 * @returns {Date}
 */
export function getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1);
}

/**
 * Get the last day of a month
 * @param {number} year - Month (0-11)
 * @param {number} month - Month (0-11)
 * @returns {Date}
 */
export function getLastDayOfMonth(year, month) {
    return new Date(year, month + 1, 0);
}

/**
 * Get the number of days in a month
 * @param {number} year - Year
 * @param {number} month - Month (0-11)
 * @returns {number}
 */
export function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

/**
 * Add days to a date
 * @param {string|Date} date - Date string or Date object
 * @param {number} days - Number of days to add (can be negative)
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function addDays(date, days) {
    const d = typeof date === 'string' ? parseLocalDate(date) : new Date(date);
    d.setDate(d.getDate() + days);
    return formatLocalDate(d);
}

/**
 * Add months to a date
 * @param {string|Date} date - Date string or Date object
 * @param {number} months - Number of months to add (can be negative)
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function addMonths(date, months) {
    const d = typeof date === 'string' ? parseLocalDate(date) : new Date(date);
    d.setMonth(d.getMonth() + months);
    return formatLocalDate(d);
}

/**
 * Get relative day description
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} 'Today', 'Tomorrow', 'Yesterday', or formatted date
 */
export function getRelativeDay(dateStr) {
    const today = getLocalToday();
    
    if (dateStr === today) {
        return 'Today';
    }
    
    if (dateStr === addDays(today, 1)) {
        return 'Tomorrow';
    }
    
    if (dateStr === addDays(today, -1)) {
        return 'Yesterday';
    }
    
    // Return formatted date for other days
    return formatDisplayDate(dateStr);
}

/**
 * Format date for display (e.g., "Monday, January 15, 2024")
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string}
 */
export function formatDisplayDate(dateStr) {
    const date = parseLocalDate(dateStr);
    return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

/**
 * Format date short (e.g., "Jan 15")
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string}
 */
export function formatShortDate(dateStr) {
    const date = parseLocalDate(dateStr);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
    });
}

/**
 * Get the ISO week number for a date
 * @param {string|Date} date - Date string or Date object
 * @returns {number} Week number (1-52)
 */
export function getWeekNumber(date) {
    const d = typeof date === 'string' ? parseLocalDate(date) : new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Compare two date strings
 * @param {string} date1 - First date string
 * @param {string} date2 - Second date string
 * @returns {number} -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export function compareDates(date1, date2) {
    if (date1 < date2) return -1;
    if (date1 > date2) return 1;
    return 0;
}

/**
 * Check if a date is within a range (inclusive)
 * @param {string} date - Date to check
 * @param {string} start - Start of range
 * @param {string} end - End of range
 * @returns {boolean}
 */
export function isDateInRange(date, start, end) {
    return date >= start && date <= end;
}

/**
 * Get array of dates between two dates (inclusive)
 * @param {string} start - Start date
 * @param {string} end - End date
 * @returns {string[]} Array of date strings
 */
export function getDateRange(start, end) {
    const dates = [];
    let current = start;
    
    while (current <= end) {
        dates.push(current);
        current = addDays(current, 1);
    }
    
    return dates;
}

// Month names for formatting
export const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// Short month names
export const MONTH_NAMES_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

// Day names (starting Monday)
export const DAY_NAMES = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

// Short day names
export const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

