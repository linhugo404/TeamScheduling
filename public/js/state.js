/**
 * Shared Application State
 * Central state management for the Office Booking System
 */

export const state = {
    currentDate: new Date(),
    currentLocation: 'jhb',
    locations: [],
    teams: [],
    bookings: [],
    publicHolidays: [],
    selectedDate: null,
    viewers: [],
    myName: null,
    myUserId: null,
    currentRoom: null,
    bookingsCache: {} // "locationId:year-month" -> { bookings: [], fetchedAt: Date }
};

// Cache settings
export const BOOKINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// DOM Elements - populated after DOM is ready
export const elements = {
    locationSelect: null,
    capacityLabel: null,
    capacityFill: null,
    currentMonth: null,
    calendarGrid: null,
    bookingModal: null,
    bookingForm: null,
    teamSelect: null,
    teamModal: null,
    teamForm: null,
    locationModal: null,
    locationForm: null,
    toastContainer: null
};

/**
 * Initialize DOM element references
 * Call this after DOM is ready
 */
export function initElements() {
    elements.locationSelect = document.getElementById('locationSelect');
    elements.capacityLabel = document.getElementById('capacityLabel');
    elements.capacityFill = document.getElementById('capacityFill');
    elements.currentMonth = document.getElementById('currentMonth');
    elements.calendarGrid = document.getElementById('calendarGrid');
    elements.bookingModal = document.getElementById('bookingModal');
    elements.bookingForm = document.getElementById('bookingForm');
    elements.teamSelect = document.getElementById('teamSelect');
    elements.teamModal = document.getElementById('teamModal');
    elements.teamForm = document.getElementById('teamForm');
    elements.locationModal = document.getElementById('locationModal');
    elements.locationForm = document.getElementById('locationForm');
    elements.toastContainer = document.getElementById('toastContainer');
}

