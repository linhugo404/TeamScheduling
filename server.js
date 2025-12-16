const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase configuration!');
    console.error('Please set SUPABASE_URL and SUPABASE_SECRET_KEY environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

// Helper function to convert snake_case to camelCase
function toCamelCase(obj) {
    if (Array.isArray(obj)) {
        return obj.map(toCamelCase);
    }
    if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc, key) => {
            const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            acc[camelKey] = toCamelCase(obj[key]);
            return acc;
        }, {});
    }
    return obj;
}

// API Routes

// Get all data (locations, teams, bookings, holidays)
app.get('/api/data', async (req, res) => {
    try {
        const [
            { data: locations, error: locError },
            { data: teams, error: teamError },
            { data: bookings, error: bookError },
            { data: publicHolidays, error: holidayError },
            { data: desks, error: deskError },
            { data: deskBookings, error: deskBookError },
            { data: floorElements, error: floorError }
        ] = await Promise.all([
            supabase.from('locations').select('*'),
            supabase.from('teams').select('*'),
            supabase.from('bookings').select('*'),
            supabase.from('public_holidays').select('*'),
            supabase.from('desks').select('*'),
            supabase.from('desk_bookings').select('*'),
            supabase.from('floor_elements').select('*')
        ]);

        if (locError || teamError || bookError || holidayError || deskError || deskBookError || floorError) {
            throw new Error('Failed to fetch data');
        }

        res.json({
            locations: toCamelCase(locations),
            teams: toCamelCase(teams),
            bookings: toCamelCase(bookings),
            publicHolidays: toCamelCase(publicHolidays),
            desks: toCamelCase(desks),
            deskBookings: toCamelCase(deskBookings),
            floorElements: toCamelCase(floorElements)
        });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// Get bookings for a specific month and location
app.get('/api/bookings', async (req, res) => {
    try {
        const { year, month, location } = req.query;
        
        let query = supabase.from('bookings').select('*');
        
        if (year && month) {
            const startDate = `${year}-${String(parseInt(month) + 1).padStart(2, '0')}-01`;
            const endDate = new Date(parseInt(year), parseInt(month) + 1, 0).toISOString().split('T')[0];
            query = query.gte('date', startDate).lte('date', endDate);
        }
        
        if (location) {
            query = query.eq('location_id', location);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        res.json(toCamelCase(data));
    } catch (error) {
        console.error('Error fetching bookings:', error);
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
        
        // Get location capacity
        const { data: location, error: locError } = await supabase
            .from('locations')
            .select('capacity')
            .eq('id', locationId)
            .single();
        
        if (locError || !location) {
            return res.status(400).json({ error: 'Invalid location' });
        }
        
        // Check if team already has a booking for this date and location
        const { data: existingTeamBooking } = await supabase
            .from('bookings')
            .select('id')
            .eq('date', date)
            .eq('location_id', locationId)
            .eq('team_id', teamId)
            .single();
        
        if (existingTeamBooking) {
            return res.status(400).json({ 
                error: `${teamName || teamId} already has a booking for this date` 
            });
        }
        
        // Calculate current bookings for that date and location
        const { data: existingBookings } = await supabase
            .from('bookings')
            .select('people_count')
            .eq('date', date)
            .eq('location_id', locationId);
        
        const currentTotal = (existingBookings || []).reduce((sum, b) => sum + b.people_count, 0);
        
        if (currentTotal + peopleCount > location.capacity) {
            return res.status(400).json({ 
                error: `Exceeds capacity. Available: ${location.capacity - currentTotal}` 
            });
        }
        
        const newBooking = {
            id: Date.now().toString(),
            date,
            team_id: teamId,
            team_name: teamName || teamId,
            people_count: parseInt(peopleCount),
            location_id: locationId,
            notes: notes || '',
            created_at: new Date().toISOString()
        };
        
        const { data, error } = await supabase
            .from('bookings')
            .insert(newBooking)
            .select()
            .single();
        
        if (error) throw error;

        const booking = toCamelCase(data);
        emitRoomDataChanged(roomKeyForBooking(booking.date, booking.locationId), {
            type: 'booking:created',
            booking
        });
        
        res.status(201).json(booking);
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ error: 'Failed to create booking' });
    }
});

// Update a booking
app.put('/api/bookings/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        // Get current booking
        const { data: booking, error: fetchError } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', id)
            .single();
        
        if (fetchError || !booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        const targetDate = updates.date || booking.date;
        const targetLocation = updates.locationId || booking.location_id;
        const targetTeamId = updates.teamId || booking.team_id;
        
        // Check if team already has a booking for the target date (if date is changing)
        if (updates.date && updates.date !== booking.date) {
            const { data: existingTeamBooking } = await supabase
                .from('bookings')
                .select('id')
                .eq('date', updates.date)
                .eq('location_id', targetLocation)
                .eq('team_id', targetTeamId)
                .neq('id', id)
                .single();
            
            if (existingTeamBooking) {
                return res.status(400).json({ 
                    error: `${booking.team_name} already has a booking for that date` 
                });
            }
        }
        
        // Check capacity
        const { data: location } = await supabase
            .from('locations')
            .select('capacity')
            .eq('id', targetLocation)
            .single();
        
        const { data: otherBookings } = await supabase
            .from('bookings')
            .select('people_count')
            .eq('date', targetDate)
            .eq('location_id', targetLocation)
            .neq('id', id);
        
        const otherTotal = (otherBookings || []).reduce((sum, b) => sum + b.people_count, 0);
        const newPeopleCount = updates.peopleCount ? parseInt(updates.peopleCount) : booking.people_count;
        
        if (otherTotal + newPeopleCount > location.capacity) {
            return res.status(400).json({ 
                error: `Exceeds capacity. Available: ${location.capacity - otherTotal}` 
            });
        }
        
        // Convert camelCase to snake_case for update
        const dbUpdates = {};
        if (updates.date) dbUpdates.date = updates.date;
        if (updates.teamId) dbUpdates.team_id = updates.teamId;
        if (updates.teamName) dbUpdates.team_name = updates.teamName;
        if (updates.peopleCount) dbUpdates.people_count = parseInt(updates.peopleCount);
        if (updates.locationId) dbUpdates.location_id = updates.locationId;
        if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
        
        const { data: updated, error: updateError } = await supabase
            .from('bookings')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();
        
        if (updateError) throw updateError;

        const before = toCamelCase(booking);
        const after = toCamelCase(updated);
        const beforeRoom = roomKeyForBooking(before.date, before.locationId);
        const afterRoom = roomKeyForBooking(after.date, after.locationId);

        emitRoomDataChanged(afterRoom, { type: 'booking:updated', booking: after, before });
        if (beforeRoom !== afterRoom) {
            emitRoomDataChanged(beforeRoom, { type: 'booking:moved_out', booking: after, before });
        }
        
        res.json(after);
    } catch (error) {
        console.error('Error updating booking:', error);
        res.status(500).json({ error: 'Failed to update booking' });
    }
});

// Generate ICS calendar file for a booking
app.get('/api/bookings/:id/ics', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', id)
            .single();
        
        if (bookingError || !booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        const { data: location } = await supabase
            .from('locations')
            .select('name')
            .eq('id', booking.location_id)
            .single();
        
        const { data: team } = await supabase
            .from('teams')
            .select('manager')
            .eq('id', booking.team_id)
            .single();
        
        const startDate = booking.date.replace(/-/g, '');
        
        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Office Booking System//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            `DTSTART;VALUE=DATE:${startDate}`,
            `DTEND;VALUE=DATE:${startDate}`,
            `SUMMARY:${booking.team_name} - Office Booking`,
            `DESCRIPTION:Team: ${booking.team_name}\\nPeople: ${booking.people_count}\\nManager: ${team?.manager || 'N/A'}\\n${booking.notes || ''}`,
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
        console.error('Error generating ICS:', error);
        res.status(500).json({ error: 'Failed to generate calendar file' });
    }
});

// Delete a booking
app.delete('/api/bookings/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get booking first for socket emit
        const { data: booking } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', id)
            .single();
        
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        const { error } = await supabase
            .from('bookings')
            .delete()
            .eq('id', id);
        
        if (error) throw error;

        const removed = toCamelCase(booking);
        emitRoomDataChanged(roomKeyForBooking(removed.date, removed.locationId), {
            type: 'booking:deleted',
            booking: removed
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting booking:', error);
        res.status(500).json({ error: 'Failed to delete booking' });
    }
});

// Manage locations
app.post('/api/locations', async (req, res) => {
    try {
        const { name, address, capacity, floors } = req.body;
        
        const newLocation = {
            id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
            name,
            address: address || '',
            capacity: parseInt(capacity) || 21,
            floors: parseInt(floors) || 1
        };
        
        const { data, error } = await supabase
            .from('locations')
            .insert(newLocation)
            .select()
            .single();
        
        if (error) throw error;
        res.status(201).json(toCamelCase(data));
    } catch (error) {
        console.error('Error creating location:', error);
        res.status(500).json({ error: 'Failed to create location' });
    }
});

app.delete('/api/locations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Delete associated bookings first (cascade should handle this, but being explicit)
        await supabase.from('bookings').delete().eq('location_id', id);
        
        const { error } = await supabase
            .from('locations')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting location:', error);
        res.status(500).json({ error: 'Failed to delete location' });
    }
});

// Update a location
app.put('/api/locations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const dbUpdates = {};
        if (updates.name) dbUpdates.name = updates.name;
        if (updates.address !== undefined) dbUpdates.address = updates.address;
        if (updates.capacity) dbUpdates.capacity = parseInt(updates.capacity);
        if (updates.floors) dbUpdates.floors = parseInt(updates.floors);
        if (updates.floorPlanWidth) dbUpdates.floor_plan_width = parseInt(updates.floorPlanWidth);
        if (updates.floorPlanHeight) dbUpdates.floor_plan_height = parseInt(updates.floorPlanHeight);
        
        const { data, error } = await supabase
            .from('locations')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        if (!data) {
            return res.status(404).json({ error: 'Location not found' });
        }
        
        res.json(toCamelCase(data));
    } catch (error) {
        console.error('Error updating location:', error);
        res.status(500).json({ error: 'Failed to update location' });
    }
});

// Fetch public holidays from Nager.Date API
app.get('/api/holidays/fetch/:year', async (req, res) => {
    try {
        const { year } = req.params;
        const country = req.query.country || 'ZA';
        
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
        
        // Upsert holidays (insert or update on conflict)
        const { error } = await supabase
            .from('public_holidays')
            .upsert(holidays.map(h => ({ date: h.date, name: h.name })), { onConflict: 'date' });
        
        if (error) throw error;
        
        const { data: allHolidays } = await supabase
            .from('public_holidays')
            .select('*')
            .order('date');
        
        res.json(toCamelCase(allHolidays));
    } catch (error) {
        console.error('Error updating holidays:', error);
        res.status(500).json({ error: 'Failed to update holidays' });
    }
});

// Delete a holiday
app.delete('/api/holidays/:date', async (req, res) => {
    try {
        const { date } = req.params;
        
        const { error } = await supabase
            .from('public_holidays')
            .delete()
            .eq('date', date);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting holiday:', error);
        res.status(500).json({ error: 'Failed to delete holiday' });
    }
});

// Manage teams
app.post('/api/teams', async (req, res) => {
    try {
        const { name, color, memberCount, manager, managerImage, locationId } = req.body;
        
        if (!locationId) {
            return res.status(400).json({ error: 'Location is required' });
        }
        
        const newTeam = {
            id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
            name,
            manager: manager || '',
            manager_image: managerImage || '',
            color: color || '#6B7280',
            member_count: parseInt(memberCount) || 1,
            location_id: locationId
        };
        
        const { data, error } = await supabase
            .from('teams')
            .insert(newTeam)
            .select()
            .single();
        
        if (error) throw error;
        res.status(201).json(toCamelCase(data));
    } catch (error) {
        console.error('Error creating team:', error);
        res.status(500).json({ error: 'Failed to create team' });
    }
});

// Update a team
app.put('/api/teams/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const dbUpdates = {};
        if (updates.name) dbUpdates.name = updates.name;
        if (updates.manager !== undefined) dbUpdates.manager = updates.manager;
        if (updates.managerImage !== undefined) dbUpdates.manager_image = updates.managerImage;
        if (updates.color) dbUpdates.color = updates.color;
        if (updates.memberCount) dbUpdates.member_count = parseInt(updates.memberCount);
        if (updates.locationId) dbUpdates.location_id = updates.locationId;
        
        const { data, error } = await supabase
            .from('teams')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        if (!data) {
            return res.status(404).json({ error: 'Team not found' });
        }
        
        res.json(toCamelCase(data));
    } catch (error) {
        console.error('Error updating team:', error);
        res.status(500).json({ error: 'Failed to update team' });
    }
});

app.delete('/api/teams/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabase
            .from('teams')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting team:', error);
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
        
        let query = supabase.from('desks').select('*');
        if (locationId) {
            query = query.eq('location_id', locationId);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        res.json(toCamelCase(data));
    } catch (error) {
        console.error('Error fetching desks:', error);
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
        
        const newDesk = {
            id: Date.now().toString(),
            name,
            location_id: locationId,
            floor: floor || '1',
            zone: zone || '',
            x: x || 0,
            y: y || 0,
            width: width || 60,
            height: height || 40,
            desk_type: deskType || 'hotseat',
            assigned_team_id: assignedTeamId || null,
            chair_positions: chairPositions || ['bottom'],
            qr_code: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            created_at: new Date().toISOString()
        };
        
        const { data, error } = await supabase
            .from('desks')
            .insert(newDesk)
            .select()
            .single();
        
        if (error) throw error;
        res.status(201).json(toCamelCase(data));
    } catch (error) {
        console.error('Error creating desk:', error);
        res.status(500).json({ error: 'Failed to create desk' });
    }
});

// Floor plan elements (walls, rooms, labels)
app.get('/api/floor-elements', async (req, res) => {
    try {
        const { locationId, floor } = req.query;
        
        let query = supabase.from('floor_elements').select('*');
        if (locationId) query = query.eq('location_id', locationId);
        if (floor) query = query.eq('floor', floor);
        
        const { data, error } = await query;
        if (error) throw error;
        
        res.json(toCamelCase(data));
    } catch (error) {
        console.error('Error fetching floor elements:', error);
        res.status(500).json({ error: 'Failed to get floor elements' });
    }
});

app.post('/api/floor-elements', async (req, res) => {
    try {
        const { type, locationId, floor, x, y, width, height, points, label, color } = req.body;
        
        if (!type || !locationId) {
            return res.status(400).json({ error: 'Type and location are required' });
        }
        
        const newElement = {
            id: Date.now().toString(),
            type,
            location_id: locationId,
            floor: floor || '1',
            x: x || 0,
            y: y || 0,
            width: width || 100,
            height: height || 100,
            points: points || [],
            label: label || '',
            color: color || null,
            created_at: new Date().toISOString()
        };
        
        const { data, error } = await supabase
            .from('floor_elements')
            .insert(newElement)
            .select()
            .single();
        
        if (error) throw error;
        res.status(201).json(toCamelCase(data));
    } catch (error) {
        console.error('Error creating floor element:', error);
        res.status(500).json({ error: 'Failed to create floor element' });
    }
});

app.put('/api/floor-elements/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const dbUpdates = {};
        if (updates.type) dbUpdates.type = updates.type;
        if (updates.locationId) dbUpdates.location_id = updates.locationId;
        if (updates.floor) dbUpdates.floor = updates.floor;
        if (updates.x !== undefined) dbUpdates.x = updates.x;
        if (updates.y !== undefined) dbUpdates.y = updates.y;
        if (updates.width !== undefined) dbUpdates.width = updates.width;
        if (updates.height !== undefined) dbUpdates.height = updates.height;
        if (updates.points) dbUpdates.points = updates.points;
        if (updates.label !== undefined) dbUpdates.label = updates.label;
        if (updates.color !== undefined) dbUpdates.color = updates.color;
        
        const { data, error } = await supabase
            .from('floor_elements')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        if (!data) {
            return res.status(404).json({ error: 'Element not found' });
        }
        
        res.json(toCamelCase(data));
    } catch (error) {
        console.error('Error updating floor element:', error);
        res.status(500).json({ error: 'Failed to update floor element' });
    }
});

app.delete('/api/floor-elements/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabase
            .from('floor_elements')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting floor element:', error);
        res.status(500).json({ error: 'Failed to delete floor element' });
    }
});

// Update a desk
app.put('/api/desks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const dbUpdates = {};
        if (updates.name) dbUpdates.name = updates.name;
        if (updates.locationId) dbUpdates.location_id = updates.locationId;
        if (updates.floor) dbUpdates.floor = updates.floor;
        if (updates.zone !== undefined) dbUpdates.zone = updates.zone;
        if (updates.x !== undefined) dbUpdates.x = updates.x;
        if (updates.y !== undefined) dbUpdates.y = updates.y;
        if (updates.width !== undefined) dbUpdates.width = updates.width;
        if (updates.height !== undefined) dbUpdates.height = updates.height;
        if (updates.deskType) dbUpdates.desk_type = updates.deskType;
        if (updates.assignedTeamId !== undefined) dbUpdates.assigned_team_id = updates.assignedTeamId;
        if (updates.chairPositions) dbUpdates.chair_positions = updates.chairPositions;
        
        const { data, error } = await supabase
            .from('desks')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        if (!data) {
            return res.status(404).json({ error: 'Desk not found' });
        }
        
        res.json(toCamelCase(data));
    } catch (error) {
        console.error('Error updating desk:', error);
        res.status(500).json({ error: 'Failed to update desk' });
    }
});

// Delete a desk
app.delete('/api/desks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Delete desk bookings first (cascade should handle this)
        await supabase.from('desk_bookings').delete().eq('desk_id', id);
        
        const { error } = await supabase
            .from('desks')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting desk:', error);
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
        
        let query = supabase.from('desk_bookings').select('*');
        
        if (date) query = query.eq('date', date);
        if (locationId) query = query.eq('location_id', locationId);
        if (deskId) query = query.eq('desk_id', deskId);
        
        const { data, error } = await query;
        if (error) throw error;
        
        res.json(toCamelCase(data));
    } catch (error) {
        console.error('Error fetching desk bookings:', error);
        res.status(500).json({ error: 'Failed to fetch desk bookings' });
    }
});

// Create a desk booking (full day)
app.post('/api/desk-bookings', async (req, res) => {
    try {
        const { deskId, date, employeeName, employeeEmail, teamId } = req.body;
        
        if (!deskId || !date || !employeeName) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Get desk info
        const { data: desk, error: deskError } = await supabase
            .from('desks')
            .select('*')
            .eq('id', deskId)
            .single();
        
        if (deskError || !desk) {
            return res.status(400).json({ error: 'Desk not found' });
        }
        
        // Check if desk is already booked for this day
        const { data: conflicts } = await supabase
            .from('desk_bookings')
            .select('id')
            .eq('desk_id', deskId)
            .eq('date', date);
        
        if (conflicts && conflicts.length > 0) {
            return res.status(400).json({ error: 'Desk already booked for this day' });
        }
        
        const newBooking = {
            id: Date.now().toString(),
            desk_id: deskId,
            desk_name: desk.name,
            location_id: desk.location_id,
            date,
            employee_name: employeeName,
            employee_email: employeeEmail || '',
            team_id: teamId || null,
            checked_in: false,
            checked_in_at: null,
            created_at: new Date().toISOString()
        };
        
        const { data, error } = await supabase
            .from('desk_bookings')
            .insert(newBooking)
            .select()
            .single();
        
        if (error) throw error;
        res.status(201).json(toCamelCase(data));
    } catch (error) {
        console.error('Error creating desk booking:', error);
        res.status(500).json({ error: 'Failed to create desk booking' });
    }
});

// Cancel a desk booking
app.delete('/api/desk-bookings/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabase
            .from('desk_bookings')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error canceling desk booking:', error);
        res.status(500).json({ error: 'Failed to cancel desk booking' });
    }
});

// Check in to a desk booking via QR code
app.post('/api/desk-bookings/:id/checkin', async (req, res) => {
    try {
        const { id } = req.params;
        const { qrCode } = req.body;
        
        // Get booking
        const { data: booking, error: bookingError } = await supabase
            .from('desk_bookings')
            .select('*')
            .eq('id', id)
            .single();
        
        if (bookingError || !booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        // Get desk
        const { data: desk, error: deskError } = await supabase
            .from('desks')
            .select('qr_code')
            .eq('id', booking.desk_id)
            .single();
        
        if (deskError || !desk) {
            return res.status(404).json({ error: 'Desk not found' });
        }
        
        // Verify QR code
        if (qrCode && desk.qr_code !== qrCode) {
            return res.status(400).json({ error: 'Invalid QR code for this desk' });
        }
        
        // Check if booking is for today
        const today = new Date().toISOString().split('T')[0];
        if (booking.date !== today) {
            return res.status(400).json({ error: 'Can only check in on the booking date' });
        }
        
        // Update booking
        const { data: updated, error: updateError } = await supabase
            .from('desk_bookings')
            .update({
                checked_in: true,
                checked_in_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();
        
        if (updateError) throw updateError;
        
        res.json({ success: true, booking: toCamelCase(updated) });
    } catch (error) {
        console.error('Error checking in:', error);
        res.status(500).json({ error: 'Failed to check in' });
    }
});

// Get check-in page data (for QR code scan)
app.get('/api/checkin/:qrCode', async (req, res) => {
    try {
        const { qrCode } = req.params;
        
        // Get desk by QR code
        const { data: desk, error: deskError } = await supabase
            .from('desks')
            .select('*')
            .eq('qr_code', qrCode)
            .single();
        
        if (deskError || !desk) {
            return res.status(404).json({ error: 'Desk not found' });
        }
        
        // Get location
        const { data: location } = await supabase
            .from('locations')
            .select('*')
            .eq('id', desk.location_id)
            .single();
        
        // Get today's bookings for this desk
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
        console.error('Error getting check-in data:', error);
        res.status(500).json({ error: 'Failed to get check-in data' });
    }
});

// Start server
httpServer.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🏢 Office Booking System (Supabase)                    ║
║                                                           ║
║   Server running at: http://localhost:${PORT}               ║
║                                                           ║
║   Press Ctrl+C to stop                                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
});
