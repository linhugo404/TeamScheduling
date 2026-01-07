/**
 * Environment-aware logger utility
 * 
 * In production, only warnings and errors are logged.
 * In development, all log levels are enabled.
 */

const isProduction = process.env.NODE_ENV === 'production';

const logger = {
    /**
     * Log debug/info messages (silenced in production)
     */
    log: (...args) => {
        if (!isProduction) {
            console.log(...args);
        }
    },

    /**
     * Log informational messages (silenced in production)
     */
    info: (...args) => {
        if (!isProduction) {
            console.info('[INFO]', ...args);
        }
    },

    /**
     * Log warning messages (always shown)
     */
    warn: (...args) => {
        console.warn('[WARN]', ...args);
    },

    /**
     * Log error messages (always shown)
     */
    error: (...args) => {
        console.error('[ERROR]', ...args);
    },

    /**
     * Log debug messages (only in development)
     */
    debug: (...args) => {
        if (!isProduction) {
            console.debug('[DEBUG]', ...args);
        }
    }
};

module.exports = logger;

