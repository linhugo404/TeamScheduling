/**
 * API Functions
 * Centralized API calls to the backend
 */

import { state, BOOKINGS_CACHE_TTL } from './state.js';
import { apiGet, apiPost, apiPut, apiDelete } from './fetch-utils.js';

/**
 * Load all initial data from the server
 */
export async function loadData() {
    try {
        const data = await apiGet('/api/data');
        
        state.locations = data.locations || [];
        state.teams = data.teams || [];
        state.publicHolidays = data.publicHolidays || [];
        
        // Set default location
        if (state.locations.length > 0 && !state.locations.find(l => l.id === state.currentLocation)) {
            state.currentLocation = state.locations[0].id;
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

/**
 * Load bookings for the current month and location (with caching)
 */
export async function loadBookingsForMonth(forceRefresh = false) {
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    const location = state.currentLocation;
    const cacheKey = `${location}:${year}-${month}`;
    
    // Check cache
    if (!forceRefresh && state.bookingsCache[cacheKey]) {
        const cached = state.bookingsCache[cacheKey];
        if (Date.now() - cached.fetchedAt < BOOKINGS_CACHE_TTL) {
            state.bookings = cached.bookings;
            return;
        }
    }
    
    try {
        const bookings = await apiGet(`/api/bookings?year=${year}&month=${month}&location=${location}`);
        
        // Update cache
        state.bookingsCache[cacheKey] = {
            bookings,
            fetchedAt: Date.now()
        };
        
        state.bookings = bookings;
    } catch (error) {
        console.error('Error loading bookings:', error);
    }
}

/**
 * Invalidate cache for a specific month or all
 */
export function invalidateBookingsCache(year, month, location) {
    if (year !== undefined && month !== undefined && location) {
        const cacheKey = `${location}:${year}-${month}`;
        delete state.bookingsCache[cacheKey];
    } else {
        state.bookingsCache = {};
    }
}

/**
 * Create a new booking
 */
export async function createBooking(bookingData) {
    return apiPost('/api/bookings', bookingData);
}

/**
 * Update an existing booking
 */
export async function updateBooking(id, updates) {
    return apiPut(`/api/bookings/${id}`, updates);
}

/**
 * Delete a booking
 */
export async function deleteBookingApi(id) {
    return apiDelete(`/api/bookings/${id}`);
}

/**
 * Create a new team
 */
export async function createTeam(teamData) {
    return apiPost('/api/teams', teamData);
}

/**
 * Update a team
 */
export async function updateTeam(id, updates) {
    return apiPut(`/api/teams/${id}`, updates);
}

/**
 * Delete a team
 */
export async function deleteTeamApi(id) {
    return apiDelete(`/api/teams/${id}`);
}

/**
 * Create a new location
 */
export async function createLocation(locationData) {
    return apiPost('/api/locations', locationData);
}

/**
 * Update a location
 */
export async function updateLocation(id, updates) {
    return apiPut(`/api/locations/${id}`, updates);
}

/**
 * Delete a location
 */
export async function deleteLocationApi(id) {
    return apiDelete(`/api/locations/${id}`);
}

/**
 * Fetch holidays from external API
 */
export async function fetchHolidaysFromApi(year) {
    return apiGet(`/api/holidays/fetch/${year}`);
}

/**
 * Save holidays to database
 */
export async function saveHolidays(holidays) {
    return apiPost('/api/holidays', { holidays });
}

/**
 * Delete a holiday
 */
export async function deleteHolidayApi(date) {
    return apiDelete(`/api/holidays/${date}`);
}

