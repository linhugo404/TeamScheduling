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
    // Get user name - check Azure AD first, then localStorage, then generate
    let userName = null;
    let userId = null;
    let userPhoto = null;
    
    // Check for Azure AD authenticated user (set by auth.js)
    if (window.currentUser) {
        userName = window.currentUser.name || window.currentUser.email || 'Anonymous';
        userId = window.currentUser.id || window.currentUser.email;
        userPhoto = window.currentUser.photo || null;
        // Store photo in localStorage for persistence
        if (userPhoto) {
            localStorage.setItem('employeePhoto', userPhoto);
        }
    } else {
        // Check localStorage for employee name (set by Azure AD auth)
        const employeeName = localStorage.getItem('employeeName');
        const employeeEmail = localStorage.getItem('employeeEmail');
        if (employeeName || employeeEmail) {
            userName = employeeName || employeeEmail || 'Anonymous';
            userId = employeeEmail || localStorage.getItem('myUserId');
            userPhoto = localStorage.getItem('employeePhoto') || null;
        } else {
            // Fall back to old localStorage keys
            userName = localStorage.getItem('userName');
            if (!userName) {
                // Check if Azure AD user (legacy format)
                const azureUser = localStorage.getItem('azureAdUser');
                if (azureUser) {
                    try {
                        const user = JSON.parse(azureUser);
                        userName = user.name || user.email || 'Anonymous';
                        userId = user.id || user.email;
                    } catch (e) {
                        userName = 'User-' + Math.random().toString(36).substring(2, 6);
                    }
                } else {
                    userName = 'User-' + Math.random().toString(36).substring(2, 6);
                }
                localStorage.setItem('userName', userName);
            }
        }
    }
    
    // Set user ID - use Azure AD ID if available, otherwise check localStorage or generate
    if (!userId) {
        userId = localStorage.getItem('myUserId');
        if (!userId) {
            userId = 'user-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
            localStorage.setItem('myUserId', userId);
        }
    } else {
        // Store Azure AD user ID for consistency
        localStorage.setItem('myUserId', userId);
    }
    
    state.myName = userName;
    state.myUserId = userId;
    state.myPhoto = userPhoto; // Store photo for presence display
    
    console.log('Socket initialization:', { userName, userId, hasPhoto: !!userPhoto });

    // Initialize Socket.IO
    if (typeof io !== 'undefined') {
        socket = io();
        
        socket.on('connect', () => {
            console.log('Socket connected for user:', userName);
            joinCurrentRoom();
        });

        socket.on('presence:update', ({ roomKey, viewers }) => {
            // Include all viewers (including current user)
            state.viewers = viewers;
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
    if (!socket || !socket.connected) {
        console.warn('Cannot join room: socket not connected');
        return;
    }
    
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    const locationId = state.currentLocation;
    const roomKey = `presence:${locationId}:${year}-${String(month + 1).padStart(2, '0')}`;
    
    if (roomKey === state.currentRoom) {
        console.log('Already in room:', roomKey);
        return;
    }
    
    console.log('Joining room:', roomKey, 'as user:', state.myName);
    state.currentRoom = roomKey;
    
    // Add current user to viewers list immediately (will be updated by server)
    const currentUser = {
        id: state.myUserId,
        name: state.myName,
        color: stringToColor(state.myUserId),
        photo: state.myPhoto || null
    };
    
    // Update local state to include current user
    if (!state.viewers.find(v => v.id === state.myUserId)) {
        state.viewers.push(currentUser);
        renderViewers();
    }
    
    socket.emit('presence:join', {
        roomKey,
        user: currentUser
    });
}

/**
 * Render presence indicators (viewers)
 * Only shows users viewing the current month (filtered by room)
 * Includes the current user in the list
 */
export function renderViewers() {
    const container = document.getElementById('presenceAvatars');
    const countElement = document.getElementById('presenceCount');
    if (!container) return;
    
    // Ensure current user is included in the viewers list
    const allViewers = [...state.viewers];
    const currentUserInList = allViewers.find(v => v.id === state.myUserId);
    
    // Add current user if not already in the list
    if (!currentUserInList && state.myUserId && state.myName) {
        allViewers.push({
            id: state.myUserId,
            name: state.myName,
            color: stringToColor(state.myUserId),
            photo: state.myPhoto || null
        });
    }
    
    // Filter viewers to only show those in the current room (current month)
    const currentRoomViewers = allViewers.filter(v => {
        // Viewers are already filtered by room on the server, but double-check
        return true; // All viewers in state.viewers are for the current room
    });
    
    const totalViewers = currentRoomViewers.length;
    const maxShow = 3;
    const shown = currentRoomViewers.slice(0, maxShow);
    const overflow = totalViewers - maxShow;
    
    // Update count
    if (countElement) {
        if (totalViewers === 0) {
            countElement.textContent = '';
        } else {
            countElement.textContent = totalViewers;
        }
    }
    
    if (totalViewers === 0) {
        container.innerHTML = '';
        return;
    }
    
    // Render visible avatars (with photos if available)
    let html = shown.map(v => {
        if (v.photo) {
            return `
                <div class="presence-avatar presence-avatar-photo" title="${escapeHtml(v.name)}">
                    <img src="${escapeHtml(v.photo)}" alt="${escapeHtml(v.name)}" loading="lazy">
                </div>
            `;
        } else {
            return `
                <div class="presence-avatar" style="background: ${escapeHtml(v.color)}" title="${escapeHtml(v.name)}">
                    ${escapeHtml(v.name.charAt(0).toUpperCase())}
                </div>
            `;
        }
    }).join('');
    
    // Add overflow indicator if there are more users
    if (overflow > 0) {
        html += `<div class="presence-avatar presence-overflow" title="${overflow} more viewer${overflow > 1 ? 's' : ''}">+${overflow}</div>`;
    }
    
    container.innerHTML = html;
    
    // Create expanded view for hover (always create if there are any viewers)
    let expandedView = document.getElementById('presenceExpanded');
    if (!expandedView && totalViewers > 0) {
        expandedView = document.createElement('div');
        expandedView.id = 'presenceExpanded';
        expandedView.className = 'presence-expanded';
        document.body.appendChild(expandedView);
    }
    
    // Update expanded view content (show all viewers, even if 3 or fewer)
    if (expandedView && totalViewers > 0) {
        const expandedHtml = currentRoomViewers.map(v => {
            const avatarHtml = v.photo 
                ? `<div class="presence-avatar presence-avatar-photo"><img src="${escapeHtml(v.photo)}" alt="${escapeHtml(v.name)}" loading="lazy"></div>`
                : `<div class="presence-avatar" style="background: ${escapeHtml(v.color)}">${escapeHtml(v.name.charAt(0).toUpperCase())}</div>`;
            
            return `
                <div class="presence-expanded-item">
                    ${avatarHtml}
                    <span class="presence-expanded-name">${escapeHtml(v.name)}</span>
                </div>
            `;
        }).join('');
        expandedView.innerHTML = expandedHtml;
    }
    
    // Setup hover handlers (always setup if there are viewers)
    const presenceBar = document.getElementById('presenceBar');
    if (presenceBar && expandedView && totalViewers > 0) {
        // Remove existing handlers to avoid duplicates
        const newShowHandler = () => showExpandedPresence();
        const newHideHandler = () => hideExpandedPresence();
        
        // Store handlers on element for cleanup
        if (presenceBar._showHandler) {
            presenceBar.removeEventListener('mouseenter', presenceBar._showHandler);
            presenceBar.removeEventListener('mouseleave', presenceBar._hideHandler);
        }
        
        presenceBar._showHandler = newShowHandler;
        presenceBar._hideHandler = newHideHandler;
        
        // Add new handlers
        presenceBar.addEventListener('mouseenter', newShowHandler);
        presenceBar.addEventListener('mouseleave', newHideHandler);
        
        // Also handle hover on expanded view itself
        expandedView.addEventListener('mouseenter', () => {
            expandedView.classList.add('visible');
        });
        expandedView.addEventListener('mouseleave', () => {
            hideExpandedPresence();
        });
    }
}

/**
 * Show expanded presence list on hover
 */
function showExpandedPresence(e) {
    const expanded = document.getElementById('presenceExpanded');
    const presenceBar = document.getElementById('presenceBar');
    if (!expanded || !presenceBar) return;
    
    const rect = presenceBar.getBoundingClientRect();
    expanded.style.display = 'block';
    expanded.style.top = `${rect.bottom + 8}px`;
    expanded.style.left = `${rect.left}px`;
    expanded.classList.add('visible');
}

/**
 * Hide expanded presence list
 */
function hideExpandedPresence() {
    const expanded = document.getElementById('presenceExpanded');
    if (!expanded) return;
    
    // Delay hiding to allow moving mouse to expanded view
    setTimeout(() => {
        if (!expanded.matches(':hover') && !document.getElementById('presenceBar')?.matches(':hover')) {
            expanded.classList.remove('visible');
            setTimeout(() => {
                if (!expanded.matches(':hover')) {
                    expanded.style.display = 'none';
                }
            }, 200);
        }
    }, 100);
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

