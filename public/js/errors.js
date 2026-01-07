/**
 * Error Handling Utilities
 * Standardized error handling for the Office Booking System
 */

/**
 * Application error class with consistent structure
 */
export class AppError extends Error {
    /**
     * @param {string} message - Human-readable error message
     * @param {string} code - Error code for programmatic handling
     * @param {Object} details - Additional error details
     */
    constructor(message, code = 'UNKNOWN_ERROR', details = {}) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }

    /**
     * Convert to plain object for logging/serialization
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            details: this.details,
            timestamp: this.timestamp,
        };
    }
}

/**
 * Error codes used throughout the application
 */
export const ErrorCodes = {
    // Network errors
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    SERVER_ERROR: 'SERVER_ERROR',
    
    // Validation errors
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    REQUIRED_FIELD: 'REQUIRED_FIELD',
    INVALID_FORMAT: 'INVALID_FORMAT',
    
    // Auth errors
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    AUTH_EXPIRED: 'AUTH_EXPIRED',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    
    // Data errors
    NOT_FOUND: 'NOT_FOUND',
    DUPLICATE: 'DUPLICATE',
    CONFLICT: 'CONFLICT',
    
    // Business logic errors
    CAPACITY_EXCEEDED: 'CAPACITY_EXCEEDED',
    ALREADY_BOOKED: 'ALREADY_BOOKED',
    INVALID_DATE: 'INVALID_DATE',
};

/**
 * User-friendly error messages for each error code
 */
const ErrorMessages = {
    [ErrorCodes.NETWORK_ERROR]: 'Unable to connect to the server. Please check your internet connection.',
    [ErrorCodes.TIMEOUT]: 'Request timed out. Please try again.',
    [ErrorCodes.SERVER_ERROR]: 'Something went wrong on our end. Please try again later.',
    [ErrorCodes.VALIDATION_ERROR]: 'Please check your input and try again.',
    [ErrorCodes.REQUIRED_FIELD]: 'Please fill in all required fields.',
    [ErrorCodes.INVALID_FORMAT]: 'Invalid format. Please check your input.',
    [ErrorCodes.AUTH_REQUIRED]: 'Please sign in to continue.',
    [ErrorCodes.AUTH_EXPIRED]: 'Your session has expired. Please sign in again.',
    [ErrorCodes.PERMISSION_DENIED]: 'You do not have permission to perform this action.',
    [ErrorCodes.NOT_FOUND]: 'The requested item was not found.',
    [ErrorCodes.DUPLICATE]: 'This item already exists.',
    [ErrorCodes.CONFLICT]: 'This action conflicts with existing data.',
    [ErrorCodes.CAPACITY_EXCEEDED]: 'The office capacity has been exceeded.',
    [ErrorCodes.ALREADY_BOOKED]: 'This team already has a booking for this date.',
    [ErrorCodes.INVALID_DATE]: 'Please select a valid date.',
};

/**
 * Get user-friendly message for an error code
 * @param {string} code - Error code
 * @returns {string} User-friendly message
 */
export function getErrorMessage(code) {
    return ErrorMessages[code] || 'An unexpected error occurred. Please try again.';
}

/**
 * Handle an error consistently
 * @param {Error} error - The error to handle
 * @param {Function} showToast - Toast notification function
 * @param {Object} options - Additional options
 */
export function handleError(error, showToast, options = {}) {
    const { silent = false, rethrow = false } = options;
    
    // Log error for debugging (only in development)
    if (process?.env?.NODE_ENV !== 'production') {
        console.error('[AppError]', error);
    }
    
    // Don't show toast if silent
    if (!silent && showToast) {
        const message = error instanceof AppError 
            ? error.message 
            : error.message || 'An unexpected error occurred';
        showToast(message, 'error');
    }
    
    // Optionally rethrow for caller handling
    if (rethrow) {
        throw error;
    }
}

/**
 * Wrap an async function with error handling
 * @param {Function} fn - Async function to wrap
 * @param {Function} showToast - Toast notification function
 * @returns {Function} Wrapped function
 */
export function withErrorHandling(fn, showToast) {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            handleError(error, showToast);
            return null;
        }
    };
}

/**
 * Parse API error response into AppError
 * @param {Response} response - Fetch Response object
 * @returns {Promise<AppError>}
 */
export async function parseApiError(response) {
    try {
        const data = await response.json();
        return new AppError(
            data.error || data.message || `HTTP ${response.status}`,
            data.code || (response.status >= 500 ? ErrorCodes.SERVER_ERROR : ErrorCodes.VALIDATION_ERROR),
            { status: response.status, ...data }
        );
    } catch {
        return new AppError(
            `HTTP ${response.status}`,
            response.status >= 500 ? ErrorCodes.SERVER_ERROR : ErrorCodes.VALIDATION_ERROR,
            { status: response.status }
        );
    }
}

