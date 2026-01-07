/**
 * Middleware Index
 * 
 * Export all middleware for easy importing
 */

const auth = require('./auth');
const requireAuth = require('./requireAuth');

module.exports = {
    // Token verification
    authenticate: auth.authenticate,
    optionalAuth: auth.optionalAuth,
    requireRole: auth.requireRole,
    hasRole: auth.hasRole,
    extractToken: auth.extractToken,
    
    // Route protection
    requireAuthForWrites: requireAuth.requireAuthForWrites,
    requireAuth: requireAuth.requireAuth,
    requireOwnership: requireAuth.requireOwnership
};

