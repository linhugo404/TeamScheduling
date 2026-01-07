/**
 * Route-level Authentication Middleware
 * 
 * Protects write operations (POST, PUT, DELETE) while allowing read operations.
 * Designed to be used with optionalAuth at the app level.
 */

const logger = require('../utils/logger');

// Configuration - set to true to enforce authentication on write operations
const REQUIRE_AUTH_FOR_WRITES = process.env.REQUIRE_AUTH === 'true';

/**
 * Middleware that requires authentication for write operations
 * Read operations (GET, HEAD, OPTIONS) are allowed without authentication
 */
function requireAuthForWrites(req, res, next) {
    // Allow read operations without authentication
    const readMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (readMethods.includes(req.method)) {
        return next();
    }
    
    // Skip auth requirement if not enabled
    if (!REQUIRE_AUTH_FOR_WRITES) {
        return next();
    }
    
    // Check if user is authenticated
    if (!req.user || !req.user.authenticated) {
        logger.warn(`Unauthorized write attempt: ${req.method} ${req.originalUrl}`);
        return res.status(401).json({
            error: 'Authentication required for this operation',
            code: 'AUTH_REQUIRED'
        });
    }
    
    // User is authenticated, proceed
    next();
}

/**
 * Middleware that always requires authentication (for admin routes)
 */
function requireAuth(req, res, next) {
    if (!req.user || !req.user.authenticated) {
        return res.status(401).json({
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
        });
    }
    next();
}

/**
 * Middleware that requires the user to be the owner of a resource
 * Uses a callback to determine ownership
 */
function requireOwnership(getOwnerId) {
    return async (req, res, next) => {
        if (!req.user || !req.user.authenticated) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }
        
        try {
            const ownerId = await getOwnerId(req);
            if (ownerId !== req.user.id && ownerId !== req.user.email) {
                return res.status(403).json({
                    error: 'You do not have permission to modify this resource',
                    code: 'FORBIDDEN'
                });
            }
            next();
        } catch (error) {
            logger.error('Error checking ownership:', error);
            return res.status(500).json({ error: 'Failed to verify ownership' });
        }
    };
}

module.exports = {
    requireAuthForWrites,
    requireAuth,
    requireOwnership,
    REQUIRE_AUTH_FOR_WRITES
};

