/**
 * Socket.IO presence management
 * Tracks which users are viewing which rooms (location + month combinations)
 */

// Presence: roomKey -> Map(userId -> { user: {id,name,color}, connections: number })
const presenceRooms = new Map();

function ensurePresenceRoom(roomKey) {
    if (!presenceRooms.has(roomKey)) presenceRooms.set(roomKey, new Map());
    return presenceRooms.get(roomKey);
}

function broadcastPresence(io, roomKey) {
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

function emitRoomDataChanged(io, roomKey, payload) {
    io.to(roomKey).emit('data:changed', { roomKey, ...payload });
}

/**
 * Initialize Socket.IO event handlers
 * @param {Server} io - Socket.IO server instance
 */
function initializeSocketHandlers(io) {
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
                broadcastPresence(io, socket.data.roomKey);
            }

            socket.data.user = user;
            socket.data.roomKey = roomKey;
            socket.join(roomKey);

            const room = ensurePresenceRoom(roomKey);
            const entry = room.get(user.id);
            if (entry) entry.connections += 1;
            else room.set(user.id, { user, connections: 1 });

            broadcastPresence(io, roomKey);
        });

        socket.on('disconnect', () => {
            const roomKey = socket.data.roomKey;
            const userId = socket.data.user?.id;
            if (!roomKey || !userId) return;

            const room = presenceRooms.get(roomKey);
            if (!room) return;

            const entry = room.get(userId);
            if (entry) {
                entry.connections -= 1;
                if (entry.connections <= 0) room.delete(userId);
            }
            if (room.size === 0) presenceRooms.delete(roomKey);
            broadcastPresence(io, roomKey);
        });
    });
}

module.exports = {
    initializeSocketHandlers,
    roomKeyForBooking,
    roomKeyForPresence,
    emitRoomDataChanged
};

