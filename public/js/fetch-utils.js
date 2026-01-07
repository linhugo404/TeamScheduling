/**
 * Fetch Utilities
 * Provides timeout, retry, and error handling for API calls
 */

import { API_CONFIG } from './config.js';

// Use config values with fallbacks
const DEFAULT_TIMEOUT = API_CONFIG.timeout;
const DEFAULT_RETRIES = API_CONFIG.retries;
const RETRY_DELAY = API_CONFIG.retryDelay;

/**
 * Fetch with timeout support
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout and retry support
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {Object} config - Configuration object
 * @param {number} config.timeout - Timeout in milliseconds (default: 10000)
 * @param {number} config.retries - Number of retries (default: 2)
 * @param {number} config.retryDelay - Delay between retries in ms (default: 1000)
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, options = {}, config = {}) {
    const timeout = config.timeout || DEFAULT_TIMEOUT;
    const retries = config.retries ?? DEFAULT_RETRIES;
    const retryDelay = config.retryDelay || RETRY_DELAY;
    
    let lastError;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetchWithTimeout(url, options, timeout);
            
            // Don't retry on client errors (4xx), only on server errors (5xx) or network issues
            if (!response.ok && response.status >= 500 && attempt < retries) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            return response;
        } catch (error) {
            lastError = error;
            
            // Don't retry if aborted by user or if it's a client error
            if (error.name === 'AbortError') {
                throw new Error('Request timed out. Please try again.');
            }
            
            // Wait before retrying (except on last attempt)
            if (attempt < retries) {
                console.warn(`Fetch attempt ${attempt + 1} failed, retrying in ${retryDelay}ms...`);
                await sleep(retryDelay);
            }
        }
    }
    
    // All retries exhausted
    throw lastError || new Error('Request failed after multiple attempts');
}

/**
 * Helper for GET requests with retry
 * @param {string} url - The URL to fetch
 * @param {Object} config - Retry configuration
 * @returns {Promise<any>} - Parsed JSON response
 */
export async function apiGet(url, config = {}) {
    const response = await fetchWithRetry(url, { method: 'GET' }, config);
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
}

/**
 * Helper for POST requests with retry
 * @param {string} url - The URL to fetch
 * @param {any} data - Data to send
 * @param {Object} config - Retry configuration
 * @returns {Promise<any>} - Parsed JSON response
 */
export async function apiPost(url, data, config = {}) {
    const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }, config);
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
}

/**
 * Helper for PUT requests with retry
 * @param {string} url - The URL to fetch
 * @param {any} data - Data to send
 * @param {Object} config - Retry configuration
 * @returns {Promise<any>} - Parsed JSON response
 */
export async function apiPut(url, data, config = {}) {
    const response = await fetchWithRetry(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }, config);
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
}

/**
 * Helper for DELETE requests with retry
 * @param {string} url - The URL to fetch
 * @param {Object} config - Retry configuration
 * @returns {Promise<any>} - Parsed JSON response
 */
export async function apiDelete(url, config = {}) {
    const response = await fetchWithRetry(url, { method: 'DELETE' }, config);
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
}

