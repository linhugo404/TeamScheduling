/**
 * Office Booking System - Main Server
 * 
 * A modular Express.js server for managing office space bookings,
 * team schedules, desk reservations, and floor plans.
 */

// Load environment variables from .env file (for local dev)
// Render and other hosts set env vars directly
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

// Import modules
const { supabase } = require('./config/supabase');
const { initializeSocketHandlers, roomKeyForBooking, emitRoomDataChanged } = require('./socket/presence');
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const { router: bookingsRoutes, initBookingsRoutes } = require('./routes/bookings');
const locationsRoutes = require('./routes/locations');
const holidaysRoutes = require('./routes/holidays');
const teamsRoutes = require('./routes/teams');
const desksRoutes = require('./routes/desks');
const floorElementsRoutes = require('./routes/floorElements');
const deskBookingsRoutes = require('./routes/deskBookings');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server and Socket.IO
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: true, credentials: true } });

// Initialize Socket.IO handlers
initializeSocketHandlers(io);

// Initialize routes that need Socket.IO
initBookingsRoutes({
    emitRoomDataChanged: (roomKey, payload) => emitRoomDataChanged(io, roomKey, payload),
    roomKeyForBooking
});

// ============================================
// Middleware
// ============================================

// Security headers using Helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://alcdn.msauth.net", "https://unpkg.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https://graph.microsoft.com", "https://login.microsoftonline.com", "wss:", "ws:"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
        },
    },
    crossOriginEmbedderPolicy: false, // Required for loading external resources
}));

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 200 requests per windowMs
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Enable Gzip compression for all responses
app.use(compression());

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Enable CORS
app.use(cors());

// Serve static files with caching
app.use(express.static('public', {
    maxAge: '1h',
    etag: true,
    setHeaders: (res, filePath) => {
        // Longer cache for immutable assets (if you add hashed filenames)
        if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
            res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
        }
    }
}));

// ============================================
// Routes
// ============================================

// Auth routes (mounted at /auth and /api/auth)
app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);

// Data route (initial load)
app.use('/api/data', dataRoutes);

// Resource routes
app.use('/api/bookings', bookingsRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/holidays', holidaysRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/desks', desksRoutes);
app.use('/api/floor-elements', floorElementsRoutes);
app.use('/api/desk-bookings', deskBookingsRoutes);

// QR Code check-in route (legacy path)
app.get('/api/checkin/:qrCode', async (req, res) => {
    // Forward to desk-bookings route
    const { supabase } = require('./config/supabase');
    const { toCamelCase } = require('./utils/helpers');
    
    try {
        const { qrCode } = req.params;
        
        const { data: desk, error: deskError } = await supabase
            .from('desks')
            .select('*')
            .eq('qr_code', qrCode)
            .single();
        
        if (deskError || !desk) {
            return res.status(404).json({ error: 'Desk not found' });
        }
        
        const { data: location } = await supabase
            .from('locations')
            .select('*')
            .eq('id', desk.location_id)
            .single();
        
        const today = new Date().toISOString().split('T')[0];
        const { data: todayBookings } = await supabase
            .from('desk_bookings')
            .select('*')
            .eq('desk_id', desk.id)
            .eq('date', today);
        
        res.json({
            desk: toCamelCase(desk),
            location: toCamelCase(location),
            todayBookings: toCamelCase(todayBookings || [])
        });
    } catch (error) {
        logger.error('Error getting check-in data:', error);
        res.status(500).json({ error: 'Failed to get check-in data' });
    }
});

// ============================================
// Start Server
// ============================================

httpServer.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🏢 Office Booking System                               ║
║                                                           ║
║   Server running at: http://localhost:${PORT}               ║
║                                                           ║
║   Modules loaded:                                         ║
║   ✓ Auth          ✓ Bookings      ✓ Locations            ║
║   ✓ Teams         ✓ Holidays      ✓ Desks                ║
║   ✓ Floor Plans   ✓ Desk Bookings ✓ Socket.IO            ║
║                                                           ║
║   Security:                                               ║
║   ✓ Helmet (CSP, HSTS, X-Frame, etc.)                    ║
║   ✓ Rate Limiting (200 req/15min per IP)                 ║
║                                                           ║
║   Press Ctrl+C to stop                                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
});

// Export for testing
module.exports = { app, io };
