/**
 * API Functions
 * Centralized API calls to the backend
 */

import { state, BOOKINGS_CACHE_TTL } from './state.js';

/**
 * Load all initial data from the server
 */
export async function loadData() {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();
        
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
        const response = await fetch(`/api/bookings?year=${year}&month=${month}&location=${location}`);
        const bookings = await response.json();
        
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
    const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create booking');
    }
    
    return response.json();
}

/**
 * Update an existing booking
 */
export async function updateBooking(id, updates) {
    const response = await fetch(`/api/bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update booking');
    }
    
    return response.json();
}

/**
 * Delete a booking
 */
export async function deleteBookingApi(id) {
    const response = await fetch(`/api/bookings/${id}`, {
        method: 'DELETE'
    });
    
    if (!response.ok) {
        throw new Error('Failed to delete booking');
    }
    
    return response.json();
}

/**
 * Create a new team
 */
export async function createTeam(teamData) {
    const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamData)
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create team');
    }
    
    return response.json();
}

/**
 * Update a team
 */
export async function updateTeam(id, updates) {
    const response = await fetch(`/api/teams/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
        throw new Error('Failed to update team');
    }
    
    return response.json();
}

/**
 * Delete a team
 */
export async function deleteTeamApi(id) {
    const response = await fetch(`/api/teams/${id}`, {
        method: 'DELETE'
    });
    
    if (!response.ok) {
        throw new Error('Failed to delete team');
    }
    
    return response.json();
}

/**
 * Create a new location
 */
export async function createLocation(locationData) {
    const response = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationData)
    });
    
    if (!response.ok) {
        throw new Error('Failed to create location');
    }
    
    return response.json();
}

/**
 * Update a location
 */
export async function updateLocation(id, updates) {
    const response = await fetch(`/api/locations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
        throw new Error('Failed to update location');
    }
    
    return response.json();
}

/**
 * Delete a location
 */
export async function deleteLocationApi(id) {
    const response = await fetch(`/api/locations/${id}`, {
        method: 'DELETE'
    });
    
    if (!response.ok) {
        throw new Error('Failed to delete location');
    }
    
    return response.json();
}

/**
 * Fetch holidays from external API
 */
export async function fetchHolidaysFromApi(year) {
    const response = await fetch(`/api/holidays/fetch/${year}`);
    if (!response.ok) {
        throw new Error('Failed to fetch holidays');
    }
    return response.json();
}

/**
 * Save holidays to database
 */
export async function saveHolidays(holidays) {
    const response = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holidays })
    });
    
    if (!response.ok) {
        throw new Error('Failed to save holidays');
    }
    
    return response.json();
}

/**
 * Delete a holiday
 */
export async function deleteHolidayApi(date) {
    const response = await fetch(`/api/holidays/${date}`, {
        method: 'DELETE'
    });
    
    if (!response.ok) {
        throw new Error('Failed to delete holiday');
    }
    
    return response.json();
}

