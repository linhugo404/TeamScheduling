/**
 * Routes Index
 * 
 * Centralizes all route exports for cleaner imports in server.js
 */

module.exports = {
    authRoutes: require('./auth'),
    dataRoutes: require('./data'),
    bookingsModule: require('./bookings'),
    locationsRoutes: require('./locations'),
    holidaysRoutes: require('./holidays'),
    teamsRoutes: require('./teams'),
    desksRoutes: require('./desks'),
    floorElementsRoutes: require('./floorElements'),
    deskBookingsRoutes: require('./deskBookings')
};

