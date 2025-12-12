const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'bookings.json');

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: true, credentials: true } });

// Presence: roomKey -> Map(userId -> { user: {id,name,color}, connections: number })
const presenceRooms = new Map();

function ensurePresenceRoom(roomKey) {
    if (!presenceRooms.has(roomKey)) presenceRooms.set(roomKey, new Map());
    return presenceRooms.get(roomKey);
}

function broadcastPresence(roomKey) {
    const room = presenceRooms.get(roomKey);
    if (!room) return;
    const viewers = Array.from(room.values()).map(v => v.user);
    io.to(roomKey).emit('presence:update', { roomKey, viewers });
}

function roomKeyForPresence(locationId, yearMonth) {
    return `presence:${locationId}:${yearMonth}`;
}

function roomKeyForBooking(date, locationId) {
    // date expected: YYYY-MM-DD
    const [y, m] = date.split('-');
    return roomKeyForPresence(locationId, `${y}-${m}`);
}

function emitRoomDataChanged(roomKey, payload) {
    io.to(roomKey).emit('data:changed', { roomKey, ...payload });
}

io.on('connection', (socket) => {
    socket.data.user = null;
    socket.data.roomKey = null;

    socket.on('presence:join', ({ roomKey, user }) => {
        if (!roomKey || !user?.id) return;

        // Leave previous room if switching
        if (socket.data.roomKey && socket.data.roomKey !== roomKey) {
            socket.leave(socket.data.roomKey);
            const prevRoom = presenceRooms.get(socket.data.roomKey);
            if (prevRoom) {
                const prevEntry = prevRoom.get(socket.data.user?.id);
                if (prevEntry) {
                    prevEntry.connections -= 1;
                    if (prevEntry.connections <= 0) prevRoom.delete(socket.data.user.id);
                }
                if (prevRoom.size === 0) presenceRooms.delete(socket.data.roomKey);
            }
            broadcastPresence(socket.data.roomKey);
        }

        socket.data.user = user;
        socket.data.roomKey = roomKey;
        socket.join(roomKey);

        const room = ensurePresenceRoom(roomKey);
        const entry = room.get(user.id);
        if (entry) entry.connections += 1;
        else room.set(user.id, { user, connections: 1 });

        broadcastPresence(roomKey);
    });

    socket.on('disconnect', () => {
        const roomKey = socket.data.roomKey;
        const userId = socket.data.user?.id;
        if (!roomKey || !userId) return;

        const room = presenceRooms.get(roomKey);
        if (!room) return;
        const entry = room.get(userId);
        if (!entry) return;
        entry.connections -= 1;
        if (entry.connections <= 0) room.delete(userId);
        if (room.size === 0) presenceRooms.delete(roomKey);
        broadcastPresence(roomKey);
    });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ensure data directory and file exist
async function initializeDataFile() {
    const dataDir = path.join(__dirname, 'data');
    try {
        await fs.mkdir(dataDir, { recursive: true });
        try {
            await fs.access(DATA_FILE);
        } catch {
            // File doesn't exist, create with default data
            const defaultData = {
                locations: [
                    { id: 'jhb', name: 'JHB Office', capacity: 21 },
                    { id: 'cpt', name: 'Cape Town Office', capacity: 15 },
                    { id: 'dbn', name: 'Durban Office', capacity: 10 }
                ],
                teams: [],
                bookings: [],
                publicHolidays: [
                    { date: '2026-01-01', name: 'New Year\'s Day' },
                    { date: '2026-03-21', name: 'Human Rights Day' },
                    { date: '2026-04-03', name: 'Good Friday' },
                    { date: '2026-04-06', name: 'Family Day' },
                    { date: '2026-04-27', name: 'Freedom Day' },
                    { date: '2026-05-01', name: 'Workers\' Day' },
                    { date: '2026-06-16', name: 'Youth Day' },
                    { date: '2026-08-10', name: 'National Women\'s Day' },
                    { date: '2026-09-24', name: 'Heritage Day' },
                    { date: '2026-12-16', name: 'Day of Reconciliation' },
                    { date: '2026-12-25', name: 'Christmas Day' },
                    { date: '2026-12-26', name: 'Day of Goodwill' }
                ]
            };
            await fs.writeFile(DATA_FILE, JSON.stringify(defaultData, null, 2));
        }
    } catch (error) {
        console.error('Error initializing data file:', error);
    }
}

// Helper functions
async function readData() {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
}

async function writeData(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// API Routes

// Get all data (locations, teams, bookings, holidays)
app.get('/api/data', async (req, res) => {
    try {
        const data = await readData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// Get bookings for a specific month and location
app.get('/api/bookings', async (req, res) => {
    try {
        const { year, month, location } = req.query;
        const data = await readData();
        
        let bookings = data.bookings;
        
        if (year && month) {
            bookings = bookings.filter(b => {
                const date = new Date(b.date);
                return date.getFullYear() === parseInt(year) && 
                       date.getMonth() === parseInt(month);
            });
        }
        
        if (location) {
            bookings = bookings.filter(b => b.locationId === location);
        }
        
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

// Create a new booking
app.post('/api/bookings', async (req, res) => {
    try {
        const { date, teamId, teamName, peopleCount, locationId, notes } = req.body;
        
        if (!date || !teamId || !peopleCount || !locationId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const data = await readData();
        const location = data.locations.find(l => l.id === locationId);
        
        if (!location) {
            return res.status(400).json({ error: 'Invalid location' });
        }
        
        // Check if team already has a booking for this date and location
        const existingTeamBooking = data.bookings.find(
            b => b.date === date && b.locationId === locationId && b.teamId === teamId
        );
        
        if (existingTeamBooking) {
            return res.status(400).json({ 
                error: `${teamName || teamId} already has a booking for this date` 
            });
        }
        
        // Calculate current bookings for that date and location
        const existingBookings = data.bookings.filter(
            b => b.date === date && b.locationId === locationId
        );
        const currentTotal = existingBookings.reduce((sum, b) => sum + b.peopleCount, 0);
        
        if (currentTotal + peopleCount > location.capacity) {
            return res.status(400).json({ 
                error: `Exceeds capacity. Available: ${location.capacity - currentTotal}` 
            });
        }
        
        const newBooking = {
            id: Date.now().toString(),
            date,
            teamId,
            teamName: teamName || teamId,
            peopleCount: parseInt(peopleCount),
            locationId,
            notes: notes || '',
            createdAt: new Date().toISOString()
        };
        
        data.bookings.push(newBooking);
        await writeData(data);

        emitRoomDataChanged(roomKeyForBooking(newBooking.date, newBooking.locationId), {
            type: 'booking:created',
            booking: newBooking
        });
        
        res.status(201).json(newBooking);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create booking' });
    }
});

// Update a booking
app.put('/api/bookings/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const data = await readData();
        const bookingIndex = data.bookings.findIndex(b => b.id === id);
        
        if (bookingIndex === -1) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        const booking = data.bookings[bookingIndex];
        const targetDate = updates.date || booking.date;
        const targetLocation = updates.locationId || booking.locationId;
        const targetTeamId = updates.teamId || booking.teamId;
        
        // Check if team already has a booking for the target date (if date is changing)
        if (updates.date && updates.date !== booking.date) {
            const existingTeamBooking = data.bookings.find(
                b => b.date === updates.date && b.locationId === targetLocation && b.teamId === targetTeamId && b.id !== id
            );
            
            if (existingTeamBooking) {
                return res.status(400).json({ 
                    error: `${booking.teamName} already has a booking for that date` 
                });
            }
        }
        
        // Check capacity if updating people count or moving to a different date
        const location = data.locations.find(l => l.id === targetLocation);
        const otherBookings = data.bookings.filter(
            b => b.date === targetDate && b.locationId === targetLocation && b.id !== id
        );
        const otherTotal = otherBookings.reduce((sum, b) => sum + b.peopleCount, 0);
        const newPeopleCount = updates.peopleCount ? parseInt(updates.peopleCount) : booking.peopleCount;
        
        if (otherTotal + newPeopleCount > location.capacity) {
            return res.status(400).json({ 
                error: `Exceeds capacity. Available: ${location.capacity - otherTotal}` 
            });
        }
        
        const before = data.bookings[bookingIndex];
        data.bookings[bookingIndex] = { ...before, ...updates };
        await writeData(data);

        const after = data.bookings[bookingIndex];
        const beforeRoom = roomKeyForBooking(before.date, before.locationId);
        const afterRoom = roomKeyForBooking(after.date, after.locationId);

        emitRoomDataChanged(afterRoom, { type: 'booking:updated', booking: after, before });
        if (beforeRoom !== afterRoom) {
            emitRoomDataChanged(beforeRoom, { type: 'booking:moved_out', booking: after, before });
        }
        
        res.json(after);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update booking' });
    }
});

// Generate ICS calendar file for a booking
app.get('/api/bookings/:id/ics', async (req, res) => {
    try {
        const { id } = req.params;
        const data = await readData();
        const booking = data.bookings.find(b => b.id === id);
        
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        const location = data.locations.find(l => l.id === booking.locationId);
        const team = data.teams.find(t => t.id === booking.teamId);
        
        const startDate = booking.date.replace(/-/g, '');
        const endDate = startDate; // Same day
        
        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Office Booking System//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            `DTSTART;VALUE=DATE:${startDate}`,
            `DTEND;VALUE=DATE:${startDate}`,
            `SUMMARY:${booking.teamName} - Office Booking`,
            `DESCRIPTION:Team: ${booking.teamName}\\nPeople: ${booking.peopleCount}\\nManager: ${team?.manager || 'N/A'}\\n${booking.notes || ''}`,
            `LOCATION:${location?.name || 'Office'}`,
            `UID:${booking.id}@officebooking`,
            'STATUS:CONFIRMED',
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');
        
        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader('Content-Disposition', `attachment; filename="booking-${booking.id}.ics"`);
        res.send(icsContent);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate calendar file' });
    }
});

// Delete a booking
app.delete('/api/bookings/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = await readData();
        
        const bookingIndex = data.bookings.findIndex(b => b.id === id);
        if (bookingIndex === -1) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        const removed = data.bookings[bookingIndex];
        data.bookings.splice(bookingIndex, 1);
        await writeData(data);

        emitRoomDataChanged(roomKeyForBooking(removed.date, removed.locationId), {
            type: 'booking:deleted',
            booking: removed
        });
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete booking' });
    }
});

// Manage locations
app.post('/api/locations', async (req, res) => {
    try {
        const { name, address, capacity } = req.body;
        const data = await readData();
        
        const newLocation = {
            id: name.toLowerCase().replace(/\s+/g, '-'),
            name,
            address: address || '',
            capacity: parseInt(capacity) || 21
        };
        
        data.locations.push(newLocation);
        await writeData(data);
        
        res.status(201).json(newLocation);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create location' });
    }
});

app.delete('/api/locations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = await readData();
        
        data.locations = data.locations.filter(l => l.id !== id);
        data.bookings = data.bookings.filter(b => b.locationId !== id);
        await writeData(data);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete location' });
    }
});

// Update a location
app.put('/api/locations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const data = await readData();
        const locationIndex = data.locations.findIndex(l => l.id === id);
        
        if (locationIndex === -1) {
            return res.status(404).json({ error: 'Location not found' });
        }
        
        if (updates.capacity) {
            updates.capacity = parseInt(updates.capacity);
        }
        
        // Handle floor plan dimensions
        if (updates.floorPlanWidth) {
            updates.floorPlanWidth = parseInt(updates.floorPlanWidth);
        }
        if (updates.floorPlanHeight) {
            updates.floorPlanHeight = parseInt(updates.floorPlanHeight);
        }
        
        data.locations[locationIndex] = { ...data.locations[locationIndex], ...updates };
        await writeData(data);
        
        res.json(data.locations[locationIndex]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update location' });
    }
});

// Fetch public holidays from Nager.Date API
app.get('/api/holidays/fetch/:year', async (req, res) => {
    try {
        const { year } = req.params;
        const country = req.query.country || 'ZA'; // Default to South Africa
        
        const https = require('https');
        
        const fetchHolidays = () => {
            return new Promise((resolve, reject) => {
                https.get(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`, (response) => {
                    let data = '';
                    response.on('data', chunk => data += chunk);
                    response.on('end', () => {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(new Error('Failed to parse holiday data'));
                        }
                    });
                }).on('error', reject);
            });
        };
        
        const holidays = await fetchHolidays();
        
        // Transform to our format
        const formattedHolidays = holidays.map(h => ({
            date: h.date,
            name: h.localName || h.name
        }));
        
        res.json(formattedHolidays);
    } catch (error) {
        console.error('Error fetching holidays:', error);
        res.status(500).json({ error: 'Failed to fetch holidays from API' });
    }
});

// Update holidays in the database
app.post('/api/holidays', async (req, res) => {
    try {
        const { holidays } = req.body;
        const data = await readData();
        
        // Merge with existing holidays (replace same dates)
        const existingDates = new Set(holidays.map(h => h.date));
        const otherHolidays = data.publicHolidays.filter(h => !existingDates.has(h.date));
        
        data.publicHolidays = [...otherHolidays, ...holidays].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );
        
        await writeData(data);
        res.json(data.publicHolidays);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update holidays' });
    }
});

// Delete a holiday
app.delete('/api/holidays/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const data = await readData();
        
        data.publicHolidays = data.publicHolidays.filter(h => h.date !== date);
        await writeData(data);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete holiday' });
    }
});

// Manage teams
app.post('/api/teams', async (req, res) => {
    try {
        const { name, color, memberCount, manager, managerImage, locationId } = req.body;
        const data = await readData();
        
        if (!locationId) {
            return res.status(400).json({ error: 'Location is required' });
        }
        
        const newTeam = {
            id: name.toLowerCase().replace(/\s+/g, '-'),
            name,
            manager: manager || '',
            managerImage: managerImage || '',
            color: color || '#6B7280',
            memberCount: parseInt(memberCount) || 1,
            locationId: locationId
        };
        
        data.teams.push(newTeam);
        await writeData(data);
        
        res.status(201).json(newTeam);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create team' });
    }
});

// Update a team
app.put('/api/teams/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const data = await readData();
        const teamIndex = data.teams.findIndex(t => t.id === id);
        
        if (teamIndex === -1) {
            return res.status(404).json({ error: 'Team not found' });
        }
        
        data.teams[teamIndex] = { ...data.teams[teamIndex], ...updates };
        await writeData(data);
        
        res.json(data.teams[teamIndex]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update team' });
    }
});

app.delete('/api/teams/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = await readData();
        
        data.teams = data.teams.filter(t => t.id !== id);
        await writeData(data);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete team' });
    }
});

// ============================================
// Desk Management
// ============================================

// Get all desks for a location
app.get('/api/desks', async (req, res) => {
    try {
        const { locationId } = req.query;
        const data = await readData();
        
        if (!data.desks) data.desks = [];
        
        let desks = data.desks;
        if (locationId) {
            desks = desks.filter(d => d.locationId === locationId);
        }
        
        res.json(desks);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch desks' });
    }
});

// Create a new desk
app.post('/api/desks', async (req, res) => {
    try {
        const { name, locationId, floor, zone, x, y, width, height, deskType, assignedTeamId, chairPositions } = req.body;
        
        if (!name || !locationId) {
            return res.status(400).json({ error: 'Name and location are required' });
        }
        
        const data = await readData();
        if (!data.desks) data.desks = [];
        
        const newDesk = {
            id: Date.now().toString(),
            name,
            locationId,
            floor: floor || '1',
            zone: zone || '',
            x: x || 0,
            y: y || 0,
            width: width || 60,
            height: height || 40,
            deskType: deskType || 'hotseat', // hotseat, team_seat, unavailable
            assignedTeamId: assignedTeamId || null,
            chairPositions: chairPositions || ['bottom'], // top, bottom, left, right
            qrCode: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString()
        };
        
        data.desks.push(newDesk);
        await writeData(data);
        
        res.status(201).json(newDesk);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create desk' });
    }
});

// Floor plan elements (walls, rooms, labels)
app.get('/api/floor-elements', async (req, res) => {
    try {
        const { locationId, floor } = req.query;
        const data = await readData();
        if (!data.floorElements) data.floorElements = [];
        
        let elements = data.floorElements;
        if (locationId) elements = elements.filter(e => e.locationId === locationId);
        if (floor) elements = elements.filter(e => e.floor === floor);
        
        res.json(elements);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get floor elements' });
    }
});

app.post('/api/floor-elements', async (req, res) => {
    try {
        const { type, locationId, floor, x, y, width, height, points, label, color } = req.body;
        
        if (!type || !locationId) {
            return res.status(400).json({ error: 'Type and location are required' });
        }
        
        const data = await readData();
        if (!data.floorElements) data.floorElements = [];
        
        const newElement = {
            id: Date.now().toString(),
            type, // wall, room, label
            locationId,
            floor: floor || '1',
            x: x || 0,
            y: y || 0,
            width: width || 100,
            height: height || 100,
            points: points || [], // For walls/lines
            label: label || '',
            color: color || null,
            createdAt: new Date().toISOString()
        };
        
        data.floorElements.push(newElement);
        await writeData(data);
        
        res.status(201).json(newElement);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create floor element' });
    }
});

app.put('/api/floor-elements/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const data = await readData();
        if (!data.floorElements) data.floorElements = [];
        
        const elementIndex = data.floorElements.findIndex(e => e.id === id);
        if (elementIndex === -1) {
            return res.status(404).json({ error: 'Element not found' });
        }
        
        data.floorElements[elementIndex] = { ...data.floorElements[elementIndex], ...updates };
        await writeData(data);
        
        res.json(data.floorElements[elementIndex]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update floor element' });
    }
});

app.delete('/api/floor-elements/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const data = await readData();
        if (!data.floorElements) data.floorElements = [];
        
        data.floorElements = data.floorElements.filter(e => e.id !== id);
        await writeData(data);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete floor element' });
    }
});

// Update a desk
app.put('/api/desks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const data = await readData();
        if (!data.desks) data.desks = [];
        
        const deskIndex = data.desks.findIndex(d => d.id === id);
        if (deskIndex === -1) {
            return res.status(404).json({ error: 'Desk not found' });
        }
        
        data.desks[deskIndex] = { ...data.desks[deskIndex], ...updates };
        await writeData(data);
        
        res.json(data.desks[deskIndex]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update desk' });
    }
});

// Delete a desk
app.delete('/api/desks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = await readData();
        
        if (!data.desks) data.desks = [];
        data.desks = data.desks.filter(d => d.id !== id);
        
        // Also delete all bookings for this desk
        if (!data.deskBookings) data.deskBookings = [];
        data.deskBookings = data.deskBookings.filter(b => b.deskId !== id);
        
        await writeData(data);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete desk' });
    }
});

// ============================================
// Desk Bookings
// ============================================

// Get desk bookings for a date/location
app.get('/api/desk-bookings', async (req, res) => {
    try {
        const { date, locationId, deskId } = req.query;
        const data = await readData();
        
        if (!data.deskBookings) data.deskBookings = [];
        
        let bookings = data.deskBookings;
        
        if (date) {
            bookings = bookings.filter(b => b.date === date);
        }
        if (locationId) {
            bookings = bookings.filter(b => b.locationId === locationId);
        }
        if (deskId) {
            bookings = bookings.filter(b => b.deskId === deskId);
        }
        
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch desk bookings' });
    }
});

// Create a desk booking (30-min slot)
app.post('/api/desk-bookings', async (req, res) => {
    try {
        const { deskId, date, startTime, endTime, employeeName, employeeEmail, teamId } = req.body;
        
        if (!deskId || !date || !startTime || !endTime || !employeeName) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const data = await readData();
        if (!data.deskBookings) data.deskBookings = [];
        if (!data.desks) data.desks = [];
        
        const desk = data.desks.find(d => d.id === deskId);
        if (!desk) {
            return res.status(400).json({ error: 'Desk not found' });
        }
        
        // Check for conflicts
        const conflict = data.deskBookings.find(b => 
            b.deskId === deskId && 
            b.date === date &&
            ((startTime >= b.startTime && startTime < b.endTime) ||
             (endTime > b.startTime && endTime <= b.endTime) ||
             (startTime <= b.startTime && endTime >= b.endTime))
        );
        
        if (conflict) {
            return res.status(400).json({ error: 'Time slot already booked' });
        }
        
        const newBooking = {
            id: Date.now().toString(),
            deskId,
            deskName: desk.name,
            locationId: desk.locationId,
            date,
            startTime,
            endTime,
            employeeName,
            employeeEmail: employeeEmail || '',
            teamId: teamId || null,
            checkedIn: false,
            checkedInAt: null,
            createdAt: new Date().toISOString()
        };
        
        data.deskBookings.push(newBooking);
        await writeData(data);
        
        res.status(201).json(newBooking);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create desk booking' });
    }
});

// Cancel a desk booking
app.delete('/api/desk-bookings/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = await readData();
        
        if (!data.deskBookings) data.deskBookings = [];
        data.deskBookings = data.deskBookings.filter(b => b.id !== id);
        
        await writeData(data);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to cancel desk booking' });
    }
});

// Check in to a desk booking via QR code
app.post('/api/desk-bookings/:id/checkin', async (req, res) => {
    try {
        const { id } = req.params;
        const { qrCode } = req.body;
        
        const data = await readData();
        if (!data.deskBookings) data.deskBookings = [];
        if (!data.desks) data.desks = [];
        
        const booking = data.deskBookings.find(b => b.id === id);
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        const desk = data.desks.find(d => d.id === booking.deskId);
        if (!desk) {
            return res.status(404).json({ error: 'Desk not found' });
        }
        
        // Verify QR code matches the desk
        if (qrCode && desk.qrCode !== qrCode) {
            return res.status(400).json({ error: 'Invalid QR code for this desk' });
        }
        
        // Check if booking is for today
        const today = new Date().toISOString().split('T')[0];
        if (booking.date !== today) {
            return res.status(400).json({ error: 'Can only check in on the booking date' });
        }
        
        // Mark as checked in
        booking.checkedIn = true;
        booking.checkedInAt = new Date().toISOString();
        
        await writeData(data);
        
        res.json({ success: true, booking });
    } catch (error) {
        res.status(500).json({ error: 'Failed to check in' });
    }
});

// Get check-in page data (for QR code scan)
app.get('/api/checkin/:qrCode', async (req, res) => {
    try {
        const { qrCode } = req.params;
        const data = await readData();
        
        if (!data.desks) data.desks = [];
        if (!data.deskBookings) data.deskBookings = [];
        
        const desk = data.desks.find(d => d.qrCode === qrCode);
        if (!desk) {
            return res.status(404).json({ error: 'Desk not found' });
        }
        
        const location = data.locations.find(l => l.id === desk.locationId);
        
        // Get today's bookings for this desk
        const today = new Date().toISOString().split('T')[0];
        const todayBookings = data.deskBookings.filter(
            b => b.deskId === desk.id && b.date === today
        );
        
        res.json({
            desk,
            location,
            todayBookings
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get check-in data' });
    }
});

// Start server
initializeDataFile().then(() => {
    httpServer.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🏢 Office Booking System                                ║
║                                                           ║
║   Server running at: http://localhost:${PORT}               ║
║                                                           ║
║   Press Ctrl+C to stop                                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
        `);
    });
});

