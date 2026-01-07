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
 * Get the ID token for backend API authentication
 * ID tokens have the app's client ID as the audience, which the backend expects
 * @returns {Promise<string|null>}
 */
async function getAuthToken() {
    // Use the globally exposed getIdToken from auth.js for backend API calls
    if (typeof window.getIdToken === 'function') {
        try {
            return await window.getIdToken();
        } catch (error) {
            console.warn('Failed to get ID token:', error);
            return null;
        }
    }
    return null;
}

/**
 * Add authorization header if token is available
 * @param {HeadersInit} headers - Existing headers
 * @param {string|null} token - Access token
 * @returns {HeadersInit}
 */
function addAuthHeader(headers = {}, token) {
    if (token) {
        return {
            ...headers,
            'Authorization': `Bearer ${token}`
        };
    }
    return headers;
}

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
    const token = await getAuthToken();
    const headers = addAuthHeader({ 'Content-Type': 'application/json' }, token);
    
    const response = await fetchWithRetry(url, {
        method: 'POST',
        headers,
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
    const token = await getAuthToken();
    const headers = addAuthHeader({ 'Content-Type': 'application/json' }, token);
    
    const response = await fetchWithRetry(url, {
        method: 'PUT',
        headers,
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
    const token = await getAuthToken();
    const headers = addAuthHeader({}, token);
    
    const response = await fetchWithRetry(url, { 
        method: 'DELETE',
        headers
    }, config);
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
}

