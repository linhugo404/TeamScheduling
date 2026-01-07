/**
 * Frontend Configuration
 * Centralized configuration values for the Office Booking System
 * 
 * These values can be overridden by setting window.APP_CONFIG before loading this module
 */

// Check for runtime config override
const runtimeConfig = window.APP_CONFIG || {};

/**
 * API Configuration
 */
export const API_CONFIG = {
    /** Request timeout in milliseconds */
    timeout: runtimeConfig.apiTimeout || 10000,
    
    /** Number of retry attempts for failed requests */
    retries: runtimeConfig.apiRetries ?? 2,
    
    /** Delay between retries in milliseconds */
    retryDelay: runtimeConfig.apiRetryDelay || 1000,
};

/**
 * Cache Configuration
 */
export const CACHE_CONFIG = {
    /** Bookings cache time-to-live in milliseconds (5 minutes) */
    bookingsTTL: runtimeConfig.bookingsCacheTTL || 5 * 60 * 1000,
    
    /** Whether to use caching */
    enabled: runtimeConfig.cacheEnabled ?? true,
};

/**
 * UI Configuration
 */
export const UI_CONFIG = {
    /** Toast notification duration in milliseconds */
    toastDuration: runtimeConfig.toastDuration || 3000,
    
    /** Debounce delay for search/filter inputs in milliseconds */
    debounceDelay: runtimeConfig.debounceDelay || 300,
    
    /** Animation duration for calendar transitions in milliseconds */
    animationDuration: runtimeConfig.animationDuration || 300,
    
    /** Default items per page for pagination */
    itemsPerPage: runtimeConfig.itemsPerPage || 20,
};

/**
 * Feature Flags
 */
export const FEATURES = {
    /** Enable real-time presence (viewers) */
    presenceEnabled: runtimeConfig.presenceEnabled ?? true,
    
    /** Enable drag-and-drop for bookings */
    dragDropEnabled: runtimeConfig.dragDropEnabled ?? true,
    
    /** Enable calendar sync buttons */
    calendarSyncEnabled: runtimeConfig.calendarSyncEnabled ?? true,
    
    /** Enable floor plan feature */
    floorPlanEnabled: runtimeConfig.floorPlanEnabled ?? true,
};

/**
 * Validation Limits
 */
export const LIMITS = {
    /** Maximum length for notes field */
    maxNotesLength: 500,
    
    /** Maximum length for team/location names */
    maxNameLength: 100,
    
    /** Maximum team member count */
    maxTeamMembers: 1000,
    
    /** Maximum location capacity */
    maxLocationCapacity: 10000,
    
    /** Maximum floors per location */
    maxFloors: 100,
};

// Export all configs as a single object for convenience
export default {
    API_CONFIG,
    CACHE_CONFIG,
    UI_CONFIG,
    FEATURES,
    LIMITS,
};

