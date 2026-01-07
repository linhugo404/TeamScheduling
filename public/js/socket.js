/**
 * Socket.IO Real-Time Communication
 * Handles presence tracking and live updates
 */

import { state } from './state.js';
import { stringToColor, escapeHtml } from './utils.js';

let socket = null;

/**
 * Initialize Socket.IO connection
 */
export function initSocket() {
    // Use authenticated user's name
    let userName = localStorage.getItem('userName');
    if (!userName) {
        // Check if Azure AD user
        const azureUser = localStorage.getItem('azureAdUser');
        if (azureUser) {
            try {
                const user = JSON.parse(azureUser);
                userName = user.name || user.email || 'Anonymous';
            } catch (e) {
                userName = 'Anonymous';
            }
        } else {
            userName = 'User-' + Math.random().toString(36).substring(2, 6);
        }
        localStorage.setItem('userName', userName);
    }
    
    state.myName = userName;
    state.myUserId = localStorage.getItem('myUserId');
    if (!state.myUserId) {
        state.myUserId = 'user-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
        localStorage.setItem('myUserId', state.myUserId);
    }

    // Initialize Socket.IO
    if (typeof io !== 'undefined') {
        socket = io();
        
        socket.on('connect', () => {
            console.log('Socket connected');
            joinCurrentRoom();
        });

        socket.on('presence:update', ({ roomKey, viewers }) => {
            state.viewers = viewers.filter(v => v.id !== state.myUserId);
            renderViewers();
        });

        socket.on('data:changed', (payload) => {
            handleDataChange(payload);
        });
    }
}

/**
 * Join the current room based on location and month
 */
export function joinCurrentRoom() {
    if (!socket) return;
    
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    const locationId = state.currentLocation;
    const roomKey = `presence:${locationId}:${year}-${String(month + 1).padStart(2, '0')}`;
    
    if (roomKey === state.currentRoom) return;
    
    state.currentRoom = roomKey;
    socket.emit('presence:join', {
        roomKey,
        user: {
            id: state.myUserId,
            name: state.myName,
            color: stringToColor(state.myUserId)
        }
    });
}

/**
 * Render presence indicators (viewers)
 */
export function renderViewers() {
    const container = document.getElementById('presenceIndicators');
    if (!container) return;
    
    if (state.viewers.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    const maxShow = 3;
    const shown = state.viewers.slice(0, maxShow);
    const overflow = state.viewers.length - maxShow;
    
    let html = shown.map(v => `
        <div class="presence-avatar" style="background: ${escapeHtml(v.color)}" title="${escapeHtml(v.name)}">
            ${escapeHtml(v.name.charAt(0).toUpperCase())}
        </div>
    `).join('');
    
    if (overflow > 0) {
        html += `<div class="presence-avatar presence-overflow">+${overflow}</div>`;
    }
    
    container.innerHTML = html;
}

/**
 * Handle real-time data changes
 */
function handleDataChange(payload) {
    const { type, booking, before } = payload;
    
    switch (type) {
        case 'booking:created':
            if (!state.bookings.find(b => b.id === booking.id)) {
                state.bookings.push(booking);
                window.renderCalendar?.();
                window.updateCapacityDisplay?.();
            }
            break;
            
        case 'booking:updated':
        case 'booking:moved_out':
            const idx = state.bookings.findIndex(b => b.id === booking.id);
            if (idx !== -1) {
                state.bookings[idx] = booking;
            }
            window.renderCalendar?.();
            window.updateCapacityDisplay?.();
            break;
            
        case 'booking:deleted':
            state.bookings = state.bookings.filter(b => b.id !== booking.id);
            window.renderCalendar?.();
            window.updateCapacityDisplay?.();
            break;
    }
}

/**
 * Get socket instance
 */
export function getSocket() {
    return socket;
}

