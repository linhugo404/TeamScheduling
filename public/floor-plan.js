// ============================================
// Floor Plan & Desk Booking System
// Loaded on-demand when user navigates to Floor Plan view
// ============================================

// Utility function to escape HTML (XSS prevention)
function escapeHtmlFloorPlan(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Desk state
let deskState = {
    desks: [],
    deskBookings: [],
    floorElements: [],
    selectedDate: formatDateStr(new Date()),
    editMode: false,
    currentFloor: '1',
    selectedElement: null,
    activeTool: null,
    draggedDesk: null
};

async function loadDesks() {
    try {
        // Always use the main sidebar location
        const locationId = state.currentLocation;
        const floor = deskState.currentFloor;
        
        const response = await fetch(`/api/desks?locationId=${locationId}`);
        const allDesks = await response.json();
        deskState.desks = allDesks.filter(d => (d.floor || '1') === floor);
        
        const date = deskState.selectedDate;
        const bookingsResponse = await fetch(`/api/desk-bookings?locationId=${locationId}&date=${date}`);
        deskState.deskBookings = await bookingsResponse.json();
        
        // Load floor elements
        const elementsResponse = await fetch(`/api/floor-elements?locationId=${locationId}&floor=${floor}`);
        deskState.floorElements = await elementsResponse.json();
        
        renderFloorMap();
    } catch (error) {
        console.error('Failed to load desks:', error);
    }
}

let desksViewInitialized = false;

function initDesksView() {
    const dateSelect = document.getElementById('deskDateSelect');
    const deskForm = document.getElementById('deskForm');
    const deskBookingForm = document.getElementById('deskBookingForm');
    const toggleEditBtn = document.getElementById('toggleEditMode');
    const floorSelect = document.getElementById('floorSelect');
    const deskTypeSelect = document.getElementById('deskType');
    
    // Set default date to today
    dateSelect.value = deskState.selectedDate;
    
    // Update floor selector based on current location
    updateFloorSelector();
    
    // Only add event listeners once
    if (!desksViewInitialized) {
        dateSelect.addEventListener('change', (e) => {
            deskState.selectedDate = e.target.value;
            loadDesks();
        });
        
        floorSelect.addEventListener('change', (e) => {
            deskState.currentFloor = e.target.value;
            loadDesks();
        });
        
        deskForm.addEventListener('submit', handleDeskSubmit);
        deskBookingForm.addEventListener('submit', handleDeskBookingSubmit);
        toggleEditBtn.addEventListener('click', toggleEditMode);
        
        // Desk type change handler
        deskTypeSelect.addEventListener('change', (e) => {
            const teamGroup = document.getElementById('assignedTeamGroup');
            teamGroup.style.display = e.target.value === 'team_seat' ? 'block' : 'none';
        });
        
        // Toolbar button handlers
        document.querySelectorAll('.toolbar-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                if (tool === 'desk') {
                    openDeskModal();
                } else if (tool === 'room') {
                    openRoomModal();
                } else if (tool === 'wall') {
                    addWallElement();
                } else if (tool === 'label') {
                    openLabelModal();
                }
            });
        });
        
        // Delete button
        document.getElementById('deleteSelectedBtn')?.addEventListener('click', deleteSelectedElement);
        
        // Apply button for desk selection
        document.getElementById('applyDeskBtn')?.addEventListener('click', () => {
            if (deskState.selectedElement) {
                openDeskBookingModal(deskState.selectedElement.id);
            }
        });
        
        // Room, label and wall forms
        document.getElementById('roomForm')?.addEventListener('submit', handleRoomSubmit);
        document.getElementById('labelForm')?.addEventListener('submit', handleLabelSubmit);
        document.getElementById('wallForm')?.addEventListener('submit', handleWallSubmit);
        
        desksViewInitialized = true;
    }
    
    // Populate assigned team dropdown (sorted alphabetically)
    const teamSelect = document.getElementById('assignedTeamId');
    if (teamSelect) {
        const sortedTeams = [...state.teams].sort((a, b) => a.name.localeCompare(b.name));
        teamSelect.innerHTML = sortedTeams.map(t => 
            `<option value="${escapeHtmlFloorPlan(t.id)}">${escapeHtmlFloorPlan(t.name)}</option>`
        ).join('');
    }
    
    loadDesks();
}

// Update floor selector based on current location's floor count
function updateFloorSelector() {
    const floorSelect = document.getElementById('floorSelect');
    const currentLocation = state.locations.find(l => l.id === state.currentLocation);
    const floorCount = currentLocation?.floors || 1;
    
    // Populate floor options
    floorSelect.innerHTML = '';
    for (let i = 1; i <= floorCount; i++) {
        const suffix = i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th';
        floorSelect.innerHTML += `<option value="${i}">${i}${suffix} Floor</option>`;
    }
    
    // Reset to floor 1 if current floor is beyond the location's floors
    if (parseInt(deskState.currentFloor) > floorCount) {
        deskState.currentFloor = '1';
    }
    floorSelect.value = deskState.currentFloor;
    
    // Show/hide floor selector based on floor count
    floorSelect.style.display = floorCount > 1 ? 'block' : 'none';
}

function toggleEditMode() {
    deskState.editMode = !deskState.editMode;
    const editPanel = document.getElementById('editModePanel');
    const toggleBtn = document.getElementById('toggleEditMode');
    const floorMap = document.getElementById('floorMap');
    
    if (deskState.editMode) {
        editPanel.style.display = 'block';
        toggleBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Done Editing
        `;
        toggleBtn.classList.add('btn-primary');
        toggleBtn.classList.remove('btn-secondary');
        floorMap.classList.add('edit-mode');
    } else {
        editPanel.style.display = 'none';
        toggleBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Edit Layout
        `;
        toggleBtn.classList.remove('btn-primary');
        toggleBtn.classList.add('btn-secondary');
        floorMap.classList.remove('edit-mode');
    }
    
    renderFloorMap();
}

function renderFloorMap() {
    const container = document.getElementById('floorMap');
    // Use Azure AD logged-in user name, fallback to localStorage
    const myName = window.currentUser?.name || localStorage.getItem('employeeName') || '';
    
    let html = '';
    
    // Render floor elements (rooms, walls, labels) first (bottom layer)
    html += deskState.floorElements.map(el => {
        const isSelected = deskState.selectedElement?.id === el.id;
        
        if (el.type === 'room') {
            const style = `left: ${el.x || 0}px; top: ${el.y || 0}px; width: ${el.width || 150}px; height: ${el.height || 120}px; ${el.color ? `border-color: ${el.color}50; background: ${el.color}08;` : ''}`;
            const resizeHandles = deskState.editMode ? `
                <div class="resize-handle nw" data-handle="nw"></div>
                <div class="resize-handle ne" data-handle="ne"></div>
                <div class="resize-handle sw" data-handle="sw"></div>
                <div class="resize-handle se" data-handle="se"></div>
                <div class="resize-handle n" data-handle="n"></div>
                <div class="resize-handle s" data-handle="s"></div>
                <div class="resize-handle e" data-handle="e"></div>
                <div class="resize-handle w" data-handle="w"></div>
            ` : '';
            return `
                <div class="floor-room ${deskState.editMode ? 'edit-mode' : ''} ${isSelected ? 'selected' : ''}" 
                     id="element-${el.id}"
                     style="${style}"
                     data-element-id="${el.id}"
                     data-element-type="room">
                    ${el.label ? `<span class="room-label">${el.label}</span>` : ''}
                    ${resizeHandles}
                </div>
            `;
        } else if (el.type === 'wall') {
            const rotation = el.rotation || 0;
            const width = el.width || 100;
            const height = el.height || 6;
            let style = `left: ${el.x || 0}px; top: ${el.y || 0}px; width: ${width}px; height: ${height}px;`;
            if (rotation) {
                style += ` transform: rotate(${rotation}deg); transform-origin: left center;`;
            }
            const resizeHandles = deskState.editMode ? `
                <div class="resize-handle e" data-handle="e"></div>
                <div class="resize-handle w" data-handle="w"></div>
            ` : '';
            return `
                <div class="floor-wall ${deskState.editMode ? 'edit-mode' : ''} ${isSelected ? 'selected' : ''}" 
                     id="element-${el.id}"
                     style="${style}"
                     data-element-id="${el.id}"
                     data-element-type="wall"
                     onclick="selectElement('${el.id}', 'wall')">
                    ${resizeHandles}
                </div>
            `;
        } else if (el.type === 'label') {
            const style = `left: ${el.x || 0}px; top: ${el.y || 0}px;`;
            return `
                <div class="floor-label ${deskState.editMode ? 'edit-mode' : ''} ${isSelected ? 'selected' : ''}" 
                     id="element-${el.id}"
                     style="${style}"
                     data-element-id="${el.id}"
                     data-element-type="label"
                     onclick="selectElement('${el.id}', 'label')">
                    ${el.label || ''}
                </div>
            `;
        }
        return '';
    }).join('');
    
    // Check if no desks
    if (deskState.desks.length === 0 && deskState.floorElements.length === 0) {
        html = `
            <div class="no-desks-map">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                    <path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3"></path>
                </svg>
                <p>No floor plan configured</p>
                <button class="btn btn-primary" onclick="toggleEditMode();">Start Editing</button>
            </div>
        `;
        container.innerHTML = html;
        return;
    }
    
    // Render desks with chairs
    html += deskState.desks.map(desk => {
        // Find if desk is booked for the day
        const booking = deskState.deskBookings.find(b => b.deskId === desk.id);
        
        const isOccupied = !!booking;
        const isMyBooking = booking && booking.employeeName.toLowerCase() === myName.toLowerCase();
        const isUnavailable = desk.deskType === 'unavailable';
        const isTeamSeat = desk.deskType === 'team_seat';
        const isHotseat = desk.deskType === 'hotseat' || !desk.deskType;
        
        let statusClass = '';
        let teamColor = '';
        let teamName = '';
        
        // Base type class
        if (isUnavailable) {
            statusClass = 'unavailable';
        } else if (isOccupied) {
            statusClass = isMyBooking ? 'my-booking' : 'booked';
            if (booking.teamId) {
                const team = state.teams.find(t => t.id === booking.teamId);
                if (team && team.color) {
                    teamColor = team.color;
                    teamName = team.name;
                }
            }
        } else if (isTeamSeat) {
            statusClass = 'team-seat';
            const team = state.teams.find(t => t.id === desk.assignedTeamId);
            if (team) {
                teamColor = team.color;
                teamName = team.name;
            }
        } else {
            statusClass = 'hotseat';
        }
        
        const isSelected = deskState.selectedElement?.id === desk.id;
        const chairPositions = desk.chairPositions || ['bottom'];
        
        let styleStr = `left: ${desk.x || 0}px; top: ${desk.y || 0}px; width: ${desk.width || 60}px; height: ${desk.height || 40}px;`;
        if (teamColor && isOccupied) {
            // Use team color for border, but let CSS handle background for theme compatibility
            styleStr += ` border-color: ${teamColor}; --team-color: ${teamColor};`;
        }
        
        // Generate chair HTML
        const chairsHtml = chairPositions.map(pos => 
            `<div class="desk-chair ${pos}"></div>`
        ).join('');
        
        return `
            <div class="floor-desk ${statusClass} ${isSelected ? 'selected' : ''} ${deskState.editMode ? 'draggable' : ''}" 
                 id="desk-${desk.id}"
                 style="${styleStr}"
                 data-desk-id="${desk.id}"
                 onclick="handleDeskClick('${desk.id}')"
                 title="${isOccupied ? `${booking.employeeName}${teamName ? ' (' + teamName + ')' : ''} - Full Day` : isUnavailable ? 'Unavailable' : isTeamSeat ? `Team: ${teamName}` : 'Click to book'}">
                ${chairsHtml}
                <div class="desk-label">${desk.name}</div>
                ${isOccupied ? `<div class="desk-occupant">${booking.employeeName}</div>` : ''}
                ${deskState.editMode ? `
                    <div class="desk-edit-controls">
                        <button onclick="event.stopPropagation(); deleteDesk('${desk.id}')" title="Delete">×</button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
    
    // Add drag handlers in edit mode
    if (deskState.editMode) {
        setupDeskDragging();
        setupElementDragging();
    }
    
    // Scale the floor map to fit the container (use requestAnimationFrame for accurate measurements)
    requestAnimationFrame(() => scaleFloorMap());
}

// Scale floor map to fit within its container while maintaining aspect ratio
function scaleFloorMap() {
    const floorMap = document.getElementById('floorMap');
    const container = document.querySelector('.floor-map-container');
    
    if (!floorMap || !container) return;
    
    // Known natural size of the floor map
    const mapWidth = 1200;
    const mapHeight = 800;
    
    // Disable transition temporarily to prevent visual glitch
    floorMap.style.transition = 'none';
    
    // Get available container size
    const containerRect = container.getBoundingClientRect();
    const availableWidth = containerRect.width - 20; // Small padding
    const availableHeight = containerRect.height - 20;
    
    // Skip if container has no size yet
    if (availableWidth <= 0 || availableHeight <= 0) {
        requestAnimationFrame(() => scaleFloorMap());
        return;
    }
    
    // Calculate scale to fit both dimensions
    const scaleX = availableWidth / mapWidth;
    const scaleY = availableHeight / mapHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down
    
    // Check if we're on mobile (using media query match)
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    
    // On mobile, use top-left origin for better fit
    if (isMobile) {
        floorMap.style.transformOrigin = 'top left';
        // Center the scaled map
        const scaledWidth = mapWidth * scale;
        const scaledHeight = mapHeight * scale;
        const offsetX = Math.max(0, (containerRect.width - scaledWidth) / 2);
        const offsetY = Math.max(0, (containerRect.height - scaledHeight) / 2);
        floorMap.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    } else {
        floorMap.style.transformOrigin = 'center center';
        floorMap.style.transform = `scale(${scale})`;
    }
    
    // Re-enable transition after a frame
    requestAnimationFrame(() => {
        floorMap.style.transition = '';
    });
}

// Add resize listener for floor map scaling (debounced)
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (document.getElementById('desksView')?.classList.contains('active')) {
            scaleFloorMap();
        }
    }, 100);
});

function handleDeskClick(deskId) {
    const desk = deskState.desks.find(d => d.id === deskId);
    if (!desk) return;
    
    if (deskState.editMode) {
        editDesk(deskId);
        return;
    }
    
    // Check if desk is already booked
    const existingBooking = deskState.deskBookings.find(b => b.deskId === deskId);
    
    if (existingBooking) {
        // Desk is booked - show booking info popup
        showBookingInfoPopup(desk, existingBooking);
        return;
    }
    
    // Desk is available - try to book it
    
    // Don't allow booking unavailable desks
    if (desk.deskType === 'unavailable') {
        showToast('This desk is unavailable', 'error');
        return;
    }
    
    // Check team seat restrictions
    if (desk.deskType === 'team_seat') {
        const savedTeamId = localStorage.getItem('employeeTeamId');
        if (savedTeamId !== desk.assignedTeamId) {
            const team = state.teams.find(t => t.id === desk.assignedTeamId);
            showToast(`This desk is reserved for ${team?.name || 'a specific team'}`, 'warning');
            // Still allow booking but show warning
        }
    }
    
    // Use Azure AD user if logged in, otherwise check localStorage
    const userName = window.currentUser?.name || localStorage.getItem('employeeName');
    
    if (userName) {
        // Quick book with user info
        quickBookDesk(desk);
    } else {
        // No user info - show quick setup modal
        showQuickBookModal(desk);
    }
}

// Show booking info popup for booked desks
function showBookingInfoPopup(desk, booking) {
    const location = state.locations.find(l => l.id === desk.locationId);
    const team = booking.teamId ? state.teams.find(t => t.id === booking.teamId) : null;
    // Use Azure AD user name or localStorage
    const currentUserName = window.currentUser?.name || localStorage.getItem('employeeName');
    const isOwnBooking = currentUserName && booking.employeeName.toLowerCase() === currentUserName.toLowerCase();
    
    const popup = document.createElement('div');
    popup.className = 'desk-info-popup';
    popup.innerHTML = `
        <div class="desk-info-popup-content">
            <button class="popup-close" onclick="this.closest('.desk-info-popup').remove()">×</button>
            <div class="popup-header">
                <h3>${desk.name}</h3>
                <span class="popup-status booked">Booked</span>
            </div>
            <div class="popup-details">
                <div class="popup-row">
                    <span class="popup-label">Booked by</span>
                    <span class="popup-value">${booking.employeeName}</span>
                </div>
                ${team ? `
                <div class="popup-row">
                    <span class="popup-label">Team</span>
                    <span class="popup-value" style="color: ${team.color}">${team.name}</span>
                </div>
                ` : ''}
                <div class="popup-row">
                    <span class="popup-label">Date</span>
                    <span class="popup-value">${new Date(deskState.selectedDate).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                </div>
                ${booking.checkedIn ? `
                <div class="popup-row">
                    <span class="popup-label">Status</span>
                    <span class="popup-value checked-in">✓ Checked In</span>
                </div>
                ` : ''}
            </div>
            ${isOwnBooking ? `
            <div class="popup-actions">
                <button class="btn btn-danger btn-small" onclick="cancelBookingFromPopup('${booking.id}', '${desk.id}')">Cancel Booking</button>
            </div>
            ` : ''}
        </div>
    `;
    
    // Remove any existing popups
    document.querySelectorAll('.desk-info-popup').forEach(p => p.remove());
    
    document.body.appendChild(popup);
    
    // Close on click outside
    popup.addEventListener('click', (e) => {
        if (e.target === popup) popup.remove();
    });
    
    // Close on escape
    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            popup.remove();
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);
}

// Quick book a desk with user info (Azure AD or localStorage)
async function quickBookDesk(desk) {
    // Prefer Azure AD user info over localStorage
    const savedName = window.currentUser?.name || localStorage.getItem('employeeName');
    const savedEmail = window.currentUser?.email || localStorage.getItem('employeeEmail') || '';
    const savedTeamId = localStorage.getItem('employeeTeamId') || null;
    
    // Show loading state on desk
    const deskEl = document.getElementById(`desk-${desk.id}`);
    if (deskEl) deskEl.classList.add('booking');
    
    try {
        // Get ID token for authentication
        const token = window.getIdToken ? await window.getIdToken() : null;
        console.log('Desk booking - Token:', token ? `Present (${token.substring(0, 20)}...)` : 'Missing');
        if (!token) {
            console.error('No ID token available. User may need to re-authenticate.');
            showToast('Authentication required. Please refresh the page and sign in again.', 'error');
            return;
        }
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            console.log('Authorization header set:', headers['Authorization'].substring(0, 30) + '...');
        }
        
        const response = await fetch('/api/desk-bookings', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                deskId: desk.id,
                date: deskState.selectedDate,
                employeeName: savedName,
                employeeEmail: savedEmail,
                teamId: savedTeamId
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }
        
        showToast(`${desk.name} booked for the day!`, 'success');
        
        // Reload bookings
        const bookingsResponse = await fetch(`/api/desk-bookings?locationId=${state.currentLocation}&date=${deskState.selectedDate}`);
        deskState.deskBookings = await bookingsResponse.json();
        renderFloorMap();
        
    } catch (error) {
        showToast(error.message || 'Failed to book desk', 'error');
        if (deskEl) deskEl.classList.remove('booking');
    }
}

// Show quick book modal for users without saved info
function showQuickBookModal(desk) {
    const savedTeamId = localStorage.getItem('employeeTeamId');
    // Pre-fill with any available info
    const prefillName = window.currentUser?.name || localStorage.getItem('employeeName') || '';
    
    const popup = document.createElement('div');
    popup.className = 'desk-info-popup';
    popup.innerHTML = `
        <div class="desk-info-popup-content quick-book">
            <button class="popup-close" onclick="this.closest('.desk-info-popup').remove()">×</button>
            <div class="popup-header">
                <h3>Book ${desk.name}</h3>
            </div>
            <p class="popup-hint">Please sign in with Azure AD for automatic booking, or enter your name below.</p>
            <form id="quickBookForm" class="quick-book-form">
                <input type="hidden" id="quickBookDeskId" value="${desk.id}">
                <div class="form-group">
                    <input type="text" id="quickBookName" required placeholder="Your name" value="${prefillName}" autofocus>
                </div>
                <div class="form-group">
                    <select id="quickBookTeam">
                        <option value="">Team (optional)</option>
                        ${state.teams.map(team => 
                            `<option value="${team.id}" ${team.id === savedTeamId ? 'selected' : ''} style="color: ${team.color}">${team.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <button type="submit" class="btn btn-primary btn-full">Book Desk</button>
            </form>
        </div>
    `;
    
    // Remove any existing popups
    document.querySelectorAll('.desk-info-popup').forEach(p => p.remove());
    
    document.body.appendChild(popup);
    
    // Focus input
    setTimeout(() => document.getElementById('quickBookName')?.focus(), 100);
    
    // Handle form submit
    document.getElementById('quickBookForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('quickBookName').value.trim();
        const teamId = document.getElementById('quickBookTeam').value || null;
        
        if (!name) return;
        
        // Save to localStorage
        localStorage.setItem('employeeName', name);
        if (teamId) localStorage.setItem('employeeTeamId', teamId);
        
        popup.remove();
        await quickBookDesk(desk);
    });
    
    // Close on click outside
    popup.addEventListener('click', (e) => {
        if (e.target === popup) popup.remove();
    });
    
    // Close on escape
    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            popup.remove();
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);
}

// Cancel booking from popup
async function cancelBookingFromPopup(bookingId, deskId) {
    if (!confirm('Cancel this booking?')) return;
    
    try {
        // Get ID token for authentication
        const token = window.getIdToken ? await window.getIdToken() : null;
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        await fetch(`/api/desk-bookings/${bookingId}`, { 
            method: 'DELETE',
            headers
        });
        showToast('Booking cancelled', 'success');
        
        // Close popup
        document.querySelectorAll('.desk-info-popup').forEach(p => p.remove());
        
        // Reload
        const bookingsResponse = await fetch(`/api/desk-bookings?locationId=${state.currentLocation}&date=${deskState.selectedDate}`);
        deskState.deskBookings = await bookingsResponse.json();
        renderFloorMap();
        
    } catch (error) {
        showToast('Failed to cancel booking', 'error');
    }
}

function selectElement(elementId, elementType) {
    if (!deskState.editMode) return;
    
    const element = deskState.floorElements.find(e => e.id === elementId);
    if (!element) return;
    
    deskState.selectedElement = { ...element, elementType };
    
    // Update UI
    document.getElementById('selectedElementInfo').textContent = `${elementType}: ${element.label || elementId}`;
    document.getElementById('deleteSelectedBtn').style.display = 'flex';
    
    // Re-render to show selection without full reload
    document.querySelectorAll('.floor-room, .floor-wall, .floor-label').forEach(el => {
        el.classList.remove('selected');
    });
    const elDiv = document.getElementById(`element-${elementId}`);
    if (elDiv) elDiv.classList.add('selected');
}

// Handle click on floor elements (separate from drag)
function handleFloorElementClick(e) {
    if (!deskState.editMode) return;
    if (dragState.active) return; // Don't select if dragging
    
    const element = e.target.closest('.floor-room, .floor-wall, .floor-label');
    if (!element) return;
    
    const elementId = element.dataset.elementId;
    const elementType = element.dataset.elementType;
    
    if (elementId && elementType) {
        selectElement(elementId, elementType);
    }
}

async function deleteSelectedElement() {
    if (!deskState.selectedElement) return;
    
    const el = deskState.selectedElement;
    
    if (el.elementType) {
        // Floor element
        if (!confirm(`Delete this ${el.elementType}?`)) return;
        try {
            // Get ID token for authentication
            const token = window.getIdToken ? await window.getIdToken() : null;
            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            await fetch(`/api/floor-elements/${el.id}`, { 
                method: 'DELETE',
                headers
            });
            showToast(`${el.elementType} deleted`, 'success');
            loadDesks();
        } catch (error) {
            showToast('Failed to delete', 'error');
        }
    } else {
        // Desk
        deleteDesk(el.id);
    }
    
    deskState.selectedElement = null;
    document.getElementById('selectedElementInfo').textContent = 'None';
    document.getElementById('deleteSelectedBtn').style.display = 'none';
}

// Global drag state to avoid listener conflicts
let dragState = {
    active: false,
    didMove: false, // Track if we actually moved
    type: null, // 'move' or 'resize'
    elementId: null,
    elementType: null,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    initialWidth: 0,
    initialHeight: 0,
    resizeHandle: null
};

function setupElementDragging() {
    const floorMap = document.getElementById('floorMap');
    
    // Use a flag to track if we've added listeners
    if (!floorMap.dataset.listenersAdded) {
        floorMap.addEventListener('mousedown', handleElementMouseDown);
        floorMap.addEventListener('click', handleFloorElementClick);
        document.addEventListener('mousemove', handleElementMouseMove);
        document.addEventListener('mouseup', handleElementMouseUp);
        floorMap.dataset.listenersAdded = 'true';
    }
}

function handleElementMouseDown(e) {
    if (!deskState.editMode) return;
    
    const target = e.target;
    const floorMap = document.getElementById('floorMap');
    const mapRect = floorMap.getBoundingClientRect();
    
    // Check if clicking on a resize handle
    if (target.classList.contains('resize-handle')) {
        const parent = target.closest('.floor-room, .floor-wall');
        if (!parent) return;
        
        const rect = parent.getBoundingClientRect();
        dragState = {
            active: true,
            didMove: false,
            type: 'resize',
            elementId: parent.dataset.elementId,
            elementType: parent.dataset.elementType,
            startX: e.clientX,
            startY: e.clientY,
            initialX: parseInt(parent.style.left) || 0,
            initialY: parseInt(parent.style.top) || 0,
            initialWidth: parseInt(parent.style.width) || 100,
            initialHeight: parseInt(parent.style.height) || 100,
            resizeHandle: target.dataset.handle
        };
        
        parent.classList.add('resizing');
        e.preventDefault();
        e.stopPropagation();
        return;
    }
    
    // Check if clicking on a draggable element
    const element = target.closest('.floor-room.edit-mode, .floor-wall.edit-mode, .floor-label.edit-mode');
    if (!element) return;
    
    const rect = element.getBoundingClientRect();
    
    dragState = {
        active: true,
        didMove: false,
        type: 'move',
        elementId: element.dataset.elementId,
        elementType: element.dataset.elementType,
        startX: e.clientX,
        startY: e.clientY,
        initialX: rect.left - mapRect.left + floorMap.scrollLeft,
        initialY: rect.top - mapRect.top + floorMap.scrollTop,
        initialWidth: parseInt(element.style.width) || 100,
        initialHeight: parseInt(element.style.height) || 100,
        resizeHandle: null
    };
    
    element.classList.add('dragging');
    e.preventDefault();
    e.stopPropagation();
}

function handleElementMouseMove(e) {
    if (!dragState.active) return;
    
    const element = document.getElementById(`element-${dragState.elementId}`);
    if (!element) return;
    
    const deltaX = e.clientX - dragState.startX;
    const deltaY = e.clientY - dragState.startY;
    
    // Track if we've moved enough to count as a drag
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        dragState.didMove = true;
    }
    
    if (dragState.type === 'move') {
        let newX = dragState.initialX + deltaX;
        let newY = dragState.initialY + deltaY;
        
        // Snap to grid (10px)
        newX = Math.round(newX / 10) * 10;
        newY = Math.round(newY / 10) * 10;
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);
        
        element.style.left = `${newX}px`;
        element.style.top = `${newY}px`;
    } else if (dragState.type === 'resize') {
        let newWidth = dragState.initialWidth;
        let newHeight = dragState.initialHeight;
        let newX = dragState.initialX;
        let newY = dragState.initialY;
        
        const handle = dragState.resizeHandle;
        const minWidth = 30;
        const minHeight = 4;
        
        if (handle.includes('e')) {
            // East handle: right edge moves, left edge (x) stays fixed
            newWidth = Math.max(minWidth, dragState.initialWidth + deltaX);
        }
        if (handle.includes('w')) {
            // West handle: left edge moves, right edge stays fixed
            // Calculate new width first, then derive position from it
            const proposedWidth = dragState.initialWidth - deltaX;
            newWidth = Math.max(minWidth, proposedWidth);
            // Position = original right edge - new width
            const rightEdge = dragState.initialX + dragState.initialWidth;
            newX = rightEdge - newWidth;
        }
        if (handle.includes('s')) {
            // South handle: bottom edge moves, top edge (y) stays fixed
            newHeight = Math.max(minHeight, dragState.initialHeight + deltaY);
        }
        if (handle.includes('n')) {
            // North handle: top edge moves, bottom edge stays fixed
            // Calculate new height first, then derive position from it
            const proposedHeight = dragState.initialHeight - deltaY;
            newHeight = Math.max(minHeight, proposedHeight);
            // Position = original bottom edge - new height
            const bottomEdge = dragState.initialY + dragState.initialHeight;
            newY = bottomEdge - newHeight;
        }
        
        // Snap to grid
        newWidth = Math.round(newWidth / 10) * 10;
        newHeight = Math.round(newHeight / 10) * 10;
        newX = Math.round(newX / 10) * 10;
        newY = Math.round(newY / 10) * 10;
        
        element.style.width = `${newWidth}px`;
        element.style.height = `${newHeight}px`;
        element.style.left = `${newX}px`;
        element.style.top = `${newY}px`;
    }
}

async function handleElementMouseUp(e) {
    if (!dragState.active) return;
    
    const element = document.getElementById(`element-${dragState.elementId}`);
    if (element) {
        element.classList.remove('dragging', 'resizing');
        
        // Only save if we actually moved/resized
        if (dragState.didMove) {
            const newX = parseInt(element.style.left) || 0;
            const newY = parseInt(element.style.top) || 0;
            const newWidth = parseInt(element.style.width) || 100;
            const newHeight = parseInt(element.style.height) || 100;
            
            try {
                // Get ID token for authentication
                const token = window.getIdToken ? await window.getIdToken() : null;
                const headers = { 'Content-Type': 'application/json' };
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
                
                const response = await fetch(`/api/floor-elements/${dragState.elementId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ x: newX, y: newY, width: newWidth, height: newHeight })
                });
                
                if (response.ok) {
                    // Update local state
                    const idx = deskState.floorElements.findIndex(el => el.id === dragState.elementId);
                    if (idx !== -1) {
                        deskState.floorElements[idx].x = newX;
                        deskState.floorElements[idx].y = newY;
                        deskState.floorElements[idx].width = newWidth;
                        deskState.floorElements[idx].height = newHeight;
                    }
                    console.log('Element position saved:', { x: newX, y: newY, width: newWidth, height: newHeight });
                }
            } catch (error) {
                console.error('Failed to save element position:', error);
                showToast('Failed to save position', 'error');
            }
        }
    }
    
    // Reset drag state
    dragState = {
        active: false,
        didMove: false,
        type: null,
        elementId: null,
        elementType: null,
        startX: 0,
        startY: 0,
        initialX: 0,
        initialY: 0,
        initialWidth: 0,
        initialHeight: 0,
        resizeHandle: null
    };
}

function setupDeskDragging() {
    const floorMap = document.getElementById('floorMap');
    const desks = floorMap.querySelectorAll('.floor-desk.draggable');
    
    desks.forEach(deskEl => {
        let isDragging = false;
        let startX, startY, initialX, initialY;
        
        deskEl.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            
            isDragging = true;
            deskEl.classList.add('dragging');
            
            const rect = deskEl.getBoundingClientRect();
            const mapRect = floorMap.getBoundingClientRect();
            
            startX = e.clientX;
            startY = e.clientY;
            initialX = rect.left - mapRect.left;
            initialY = rect.top - mapRect.top;
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            let newX = initialX + deltaX;
            let newY = initialY + deltaY;
            
            // Snap to grid (10px)
            newX = Math.round(newX / 10) * 10;
            newY = Math.round(newY / 10) * 10;
            
            // Keep within bounds
            newX = Math.max(0, newX);
            newY = Math.max(0, newY);
            
            deskEl.style.left = `${newX}px`;
            deskEl.style.top = `${newY}px`;
        });
        
        document.addEventListener('mouseup', async () => {
            if (!isDragging) return;
            
            isDragging = false;
            deskEl.classList.remove('dragging');
            
            // Save new position
            const deskId = deskEl.dataset.deskId;
            const newX = parseInt(deskEl.style.left);
            const newY = parseInt(deskEl.style.top);
            
            try {
                // Get ID token for authentication
                const token = window.getIdToken ? await window.getIdToken() : null;
                const headers = { 'Content-Type': 'application/json' };
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
                
                await fetch(`/api/desks/${deskId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ x: newX, y: newY })
                });
                
                // Update local state
                const desk = deskState.desks.find(d => d.id === deskId);
                if (desk) {
                    desk.x = newX;
                    desk.y = newY;
                }
            } catch (error) {
                console.error('Failed to save desk position:', error);
            }
        });
    });
}

// Keep the old grid view function as a fallback
function renderDesksGrid() {
    renderFloorMap();
}

function openDeskModal(deskId = null) {
    const modal = document.getElementById('deskModal');
    const title = document.getElementById('deskModalTitle');
    const submitBtn = document.getElementById('deskFormSubmitBtn');
    const locationInput = document.getElementById('deskLocationInput');
    const deskTypeSelect = document.getElementById('deskType');
    const assignedTeamGroup = document.getElementById('assignedTeamGroup');
    const assignedTeamSelect = document.getElementById('assignedTeamId');
    
    // Populate location select with current location selected (sorted alphabetically)
    const sortedLocations = [...state.locations].sort((a, b) => a.name.localeCompare(b.name));
    locationInput.innerHTML = sortedLocations.map(loc => 
        `<option value="${escapeHtmlFloorPlan(loc.id)}" ${loc.id === state.currentLocation ? 'selected' : ''}>${escapeHtmlFloorPlan(loc.name)}</option>`
    ).join('');
    
    // Populate team select (sorted alphabetically)
    const sortedTeams = [...state.teams].sort((a, b) => a.name.localeCompare(b.name));
    assignedTeamSelect.innerHTML = sortedTeams.map(t => 
        `<option value="${escapeHtmlFloorPlan(t.id)}">${escapeHtmlFloorPlan(t.name)}</option>`
    ).join('');
    
    if (deskId) {
        const desk = deskState.desks.find(d => d.id === deskId);
        if (desk) {
            document.getElementById('editDeskId').value = desk.id;
            document.getElementById('deskName').value = desk.name;
            document.getElementById('deskFloor').value = desk.floor || deskState.currentFloor;
            document.getElementById('deskZone').value = desk.zone || '';
            document.getElementById('deskWidth').value = desk.width || 60;
            document.getElementById('deskHeight').value = desk.height || 40;
            deskTypeSelect.value = desk.deskType || 'hotseat';
            assignedTeamGroup.style.display = desk.deskType === 'team_seat' ? 'block' : 'none';
            if (desk.assignedTeamId) assignedTeamSelect.value = desk.assignedTeamId;
            locationInput.value = desk.locationId;
            
            // Set chair positions
            document.querySelectorAll('input[name="chairPos"]').forEach(cb => {
                cb.checked = (desk.chairPositions || ['bottom']).includes(cb.value);
            });
            
            title.textContent = 'Edit Desk';
            submitBtn.textContent = 'Save Changes';
        }
    } else {
        document.getElementById('deskForm').reset();
        document.getElementById('editDeskId').value = '';
        document.getElementById('deskFloor').value = deskState.currentFloor;
        document.getElementById('deskWidth').value = 60;
        document.getElementById('deskHeight').value = 40;
        deskTypeSelect.value = 'hotseat';
        assignedTeamGroup.style.display = 'none';
        
        // Reset chair positions to default
        document.querySelectorAll('input[name="chairPos"]').forEach(cb => {
            cb.checked = cb.value === 'bottom';
        });
        
        title.textContent = 'Add Desk';
        submitBtn.textContent = 'Add Desk';
    }
    
    modal.classList.add('active');
}

function closeDeskModal() {
    document.getElementById('deskModal').classList.remove('active');
    document.getElementById('deskForm').reset();
    document.getElementById('editDeskId').value = '';
}

async function handleDeskSubmit(e) {
    e.preventDefault();
    
    const editDeskId = document.getElementById('editDeskId').value;
    const name = document.getElementById('deskName').value;
    const locationId = document.getElementById('deskLocationInput').value;
    const floor = document.getElementById('deskFloor').value || deskState.currentFloor;
    const zone = document.getElementById('deskZone').value;
    const width = parseInt(document.getElementById('deskWidth').value) || 60;
    const height = parseInt(document.getElementById('deskHeight').value) || 40;
    const deskType = document.getElementById('deskType').value;
    const assignedTeamId = deskType === 'team_seat' ? document.getElementById('assignedTeamId').value : null;
    
    // Get chair positions
    const chairPositions = Array.from(document.querySelectorAll('input[name="chairPos"]:checked'))
        .map(cb => cb.value);
    
    // Calculate initial position for new desks (grid layout)
    const existingDesks = deskState.desks;
    const x = existingDesks.length > 0 ? (existingDesks.length % 8) * 90 + 50 : 50;
    const y = existingDesks.length > 0 ? Math.floor(existingDesks.length / 8) * 80 + 80 : 80;
    
    const deskData = { 
        name, locationId, floor, zone, width, height, 
        deskType, assignedTeamId, chairPositions 
    };
    
    try {
        // Get ID token for authentication
        const token = window.getIdToken ? await window.getIdToken() : null;
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        let response;
        if (editDeskId) {
            response = await fetch(`/api/desks/${editDeskId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(deskData)
            });
        } else {
            response = await fetch('/api/desks', {
                method: 'POST',
                headers,
                body: JSON.stringify({ ...deskData, x, y })
            });
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }
        
        showToast(editDeskId ? 'Desk updated' : 'Desk created', 'success');
        closeDeskModal();
        loadDesks();
        
    } catch (error) {
        showToast(error.message || 'Failed to save desk', 'error');
    }
}

function editDesk(deskId) {
    openDeskModal(deskId);
}

async function deleteDesk(deskId) {
    if (!confirm('Delete this desk? All bookings for this desk will also be deleted.')) return;
    
    try {
        // Get ID token for authentication
        const token = window.getIdToken ? await window.getIdToken() : null;
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        await fetch(`/api/desks/${deskId}`, { 
            method: 'DELETE',
            headers
        });
        showToast('Desk deleted', 'success');
        loadDesks();
    } catch (error) {
        showToast('Failed to delete desk', 'error');
    }
}

// Room modal functions
function openRoomModal(roomId = null) {
    const modal = document.getElementById('roomModal');
    const form = document.getElementById('roomForm');
    
    if (roomId) {
        const room = deskState.floorElements.find(e => e.id === roomId);
        if (room) {
            document.getElementById('editRoomId').value = room.id;
            document.getElementById('roomLabel').value = room.label || '';
            document.getElementById('roomWidth').value = room.width || 150;
            document.getElementById('roomHeight').value = room.height || 120;
            document.getElementById('roomColor').value = room.color || '#3b82f6';
        }
    } else {
        form.reset();
        document.getElementById('editRoomId').value = '';
    }
    
    modal.classList.add('active');
}

function closeRoomModal() {
    document.getElementById('roomModal').classList.remove('active');
}

async function handleRoomSubmit(e) {
    e.preventDefault();
    
    const editRoomId = document.getElementById('editRoomId').value;
    const label = document.getElementById('roomLabel').value;
    const width = parseInt(document.getElementById('roomWidth').value);
    const height = parseInt(document.getElementById('roomHeight').value);
    const color = document.getElementById('roomColor').value;
    
    const roomData = {
        type: 'room',
        locationId: state.currentLocation,
        floor: deskState.currentFloor,
        label,
        width,
        height,
        color,
        x: 50,
        y: 50
    };
    
    try {
        // Get ID token for authentication
        const token = window.getIdToken ? await window.getIdToken() : null;
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        if (editRoomId) {
            await fetch(`/api/floor-elements/${editRoomId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(roomData)
            });
        } else {
            await fetch('/api/floor-elements', {
                method: 'POST',
                headers,
                body: JSON.stringify(roomData)
            });
        }
        
        showToast(editRoomId ? 'Room updated' : 'Room added', 'success');
        closeRoomModal();
        loadDesks();
    } catch (error) {
        showToast('Failed to save room', 'error');
    }
}

// Wall functions
function openWallModal() {
    document.getElementById('wallModal').classList.add('active');
    document.getElementById('editWallId').value = '';
    document.getElementById('wallLength').value = 100;
    document.getElementById('wallThickness').value = 6;
    document.querySelector('input[name="wallOrientation"][value="0"]').checked = true;
}

function closeWallModal() {
    document.getElementById('wallModal').classList.remove('active');
    document.getElementById('wallForm').reset();
}

async function handleWallSubmit(e) {
    e.preventDefault();
    
    const length = parseInt(document.getElementById('wallLength').value) || 100;
    const thickness = parseInt(document.getElementById('wallThickness').value) || 6;
    const rotation = parseInt(document.querySelector('input[name="wallOrientation"]:checked').value) || 0;
    const editWallId = document.getElementById('editWallId').value;
    
    try {
        // Get ID token for authentication
        const token = window.getIdToken ? await window.getIdToken() : null;
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        if (editWallId) {
            // Update existing wall
            await fetch(`/api/floor-elements/${editWallId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                    width: length,
                    height: thickness,
                    rotation: rotation
                })
            });
            showToast('Wall updated', 'success');
        } else {
            // Add new wall
            await fetch('/api/floor-elements', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    type: 'wall',
                    locationId: state.currentLocation,
                    floor: deskState.currentFloor,
                    x: 100,
                    y: 100,
                    width: length,
                    height: thickness,
                    rotation: rotation
                })
            });
            showToast('Wall added - drag to position', 'success');
        }
        
        closeWallModal();
        loadDesks();
    } catch (error) {
        showToast('Failed to save wall', 'error');
    }
}

function addWallElement() {
    openWallModal();
}

// Label modal functions
function openLabelModal(labelId = null) {
    const modal = document.getElementById('labelModal');
    const form = document.getElementById('labelForm');
    
    if (labelId) {
        const label = deskState.floorElements.find(e => e.id === labelId);
        if (label) {
            document.getElementById('editLabelId').value = label.id;
            document.getElementById('labelText').value = label.label || '';
        }
    } else {
        form.reset();
        document.getElementById('editLabelId').value = '';
    }
    
    modal.classList.add('active');
}

function closeLabelModal() {
    document.getElementById('labelModal').classList.remove('active');
}

async function handleLabelSubmit(e) {
    e.preventDefault();
    
    const editLabelId = document.getElementById('editLabelId').value;
    const labelText = document.getElementById('labelText').value;
    
    const labelData = {
        type: 'label',
        locationId: state.currentLocation,
        floor: deskState.currentFloor,
        label: labelText,
        x: 100,
        y: 100
    };
    
    try {
        // Get ID token for authentication
        const token = window.getIdToken ? await window.getIdToken() : null;
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        if (editLabelId) {
            await fetch(`/api/floor-elements/${editLabelId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(labelData)
            });
        } else {
            await fetch('/api/floor-elements', {
                method: 'POST',
                headers,
                body: JSON.stringify(labelData)
            });
        }
        
        showToast(editLabelId ? 'Label updated' : 'Label added', 'success');
        closeLabelModal();
        loadDesks();
    } catch (error) {
        showToast('Failed to save label', 'error');
    }
}

function openDeskBookingModal(deskId) {
    const desk = deskState.desks.find(d => d.id === deskId);
    if (!desk) return;
    
    const modal = document.getElementById('deskBookingModal');
    const infoDiv = document.getElementById('deskBookingInfo');
    const bookingForm = document.getElementById('deskBookingForm');
    const location = state.locations.find(l => l.id === desk.locationId);
    
    // Check if desk is already booked for this day
    const existingBooking = deskState.deskBookings.find(b => b.deskId === deskId);
    const isBooked = !!existingBooking;
    
    document.getElementById('bookingDeskId').value = deskId;
    document.getElementById('bookingDate').value = deskState.selectedDate;
    
    // Show/hide the booking form based on whether desk is already booked
    bookingForm.style.display = isBooked ? 'none' : 'block';
    
    if (!isBooked) {
        // Use Azure AD user info or localStorage
        const savedName = window.currentUser?.name || localStorage.getItem('employeeName');
        const savedEmail = window.currentUser?.email || localStorage.getItem('employeeEmail');
        const savedTeamId = localStorage.getItem('employeeTeamId');
        if (savedName) document.getElementById('employeeName').value = savedName;
        if (savedEmail) document.getElementById('employeeEmail').value = savedEmail;
        
        // Populate team selector (sorted alphabetically)
        const teamSelect = document.getElementById('deskBookingTeam');
        const sortedTeams = [...state.teams].sort((a, b) => a.name.localeCompare(b.name));
        teamSelect.innerHTML = '<option value="">-- No team --</option>' + 
            sortedTeams.map(team => 
                `<option value="${escapeHtmlFloorPlan(team.id)}" ${team.id === savedTeamId ? 'selected' : ''} style="color: ${escapeHtmlFloorPlan(team.color)}">${escapeHtmlFloorPlan(team.name)}</option>`
            ).join('');
    }
    
    infoDiv.innerHTML = `
        <h3>${escapeHtmlFloorPlan(desk.name)}</h3>
        <p>${escapeHtmlFloorPlan(location?.name || '')} ${desk.floor ? `• Floor ${desk.floor}` : ''} ${desk.zone ? `• ${escapeHtmlFloorPlan(desk.zone)}` : ''}</p>
        <p class="booking-date">${new Date(deskState.selectedDate).toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p class="booking-type">${isBooked ? 'Currently Booked' : 'Full Day Booking'}</p>
    `;
    
    renderDeskBookingsList(deskId);
    
    modal.classList.add('active');
}

function closeDeskBookingModal() {
    document.getElementById('deskBookingModal').classList.remove('active');
    document.getElementById('deskBookingForm').reset();
    document.getElementById('deskBookingForm').style.display = 'block'; // Reset form visibility
}

async function handleDeskBookingSubmit(e) {
    console.log('===== handleDeskBookingSubmit CALLED =====');
    e.preventDefault();
    
    const deskId = document.getElementById('bookingDeskId').value;
    const date = document.getElementById('bookingDate').value;
    const employeeName = document.getElementById('employeeName').value;
    const employeeEmail = document.getElementById('employeeEmail').value;
    const teamId = document.getElementById('deskBookingTeam').value || null;
    
    // Save to localStorage for convenience
    localStorage.setItem('employeeName', employeeName);
    if (employeeEmail) localStorage.setItem('employeeEmail', employeeEmail);
    if (teamId) localStorage.setItem('employeeTeamId', teamId);
    
    try {
        // Get ID token for authentication
        const token = window.getIdToken ? await window.getIdToken() : null;
        
        if (!token) {
            showToast('Authentication required. Please refresh and sign in again.', 'error');
            return;
        }
        
        const headers = { 'Content-Type': 'application/json' };
        headers['Authorization'] = `Bearer ${token}`;
        
        const response = await fetch('/api/desk-bookings', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                deskId,
                date,
                employeeName,
                employeeEmail,
                teamId
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }
        
        showToast('Desk booked for the day!', 'success');
        
        // Reload bookings and close modal
        const bookingsResponse = await fetch(`/api/desk-bookings?locationId=${state.currentLocation}&date=${date}`);
        deskState.deskBookings = await bookingsResponse.json();
        
        closeDeskBookingModal();
        renderFloorMap();
        
    } catch (error) {
        showToast(error.message || 'Failed to book desk', 'error');
    }
}

function renderDeskBookingsList(deskId) {
    const container = document.getElementById('deskBookingsList');
    const deskBookings = deskState.deskBookings.filter(b => b.deskId === deskId);
    
    if (deskBookings.length === 0) {
        container.innerHTML = '<p class="hint">No bookings for this day</p>';
        return;
    }
    
    container.innerHTML = deskBookings.map(booking => {
        return `
            <div class="desk-booking-item ${booking.checkedIn ? 'checked-in' : ''}">
                <div class="booking-person">${booking.employeeName}</div>
                <div class="booking-duration">Full Day</div>
                ${booking.checkedIn ? '<span class="checked-in-badge">Checked In</span>' : ''}
                <button class="btn btn-small btn-danger" data-booking-id="${booking.id}" data-desk-id="${deskId}" onclick="cancelDeskBooking(this.dataset.bookingId, this.dataset.deskId)">Cancel</button>
            </div>
        `;
    }).join('');
}

async function cancelDeskBooking(bookingId, deskId) {
    if (!confirm('Cancel this booking?')) return;
    
    try {
        // Get ID token for authentication
        const token = window.getIdToken ? await window.getIdToken() : null;
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        await fetch(`/api/desk-bookings/${bookingId}`, { 
            method: 'DELETE',
            headers
        });
        showToast('Booking cancelled', 'success');
        
        // Reload
        const date = deskState.selectedDate;
        const bookingsResponse = await fetch(`/api/desk-bookings?locationId=${state.currentLocation}&date=${date}`);
        deskState.deskBookings = await bookingsResponse.json();
        
        renderDeskBookingsList(deskId);
        renderFloorMap();
        closeDeskBookingModal();
        
    } catch (error) {
        showToast('Failed to cancel booking', 'error');
    }
}

function showDeskQR(deskId) {
    const desk = deskState.desks.find(d => d.id === deskId);
    if (!desk) return;
    
    const qrUrl = `${window.location.origin}/checkin.html?code=${desk.qrCode}`;
    
    // Generate QR code using a free API
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`;
    
    // Create a modal to show the QR code
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'qrModal';
    modal.innerHTML = `
        <div class="modal-content modal-small" style="text-align: center;">
            <div class="modal-header">
                <h2>QR Code: ${desk.name}</h2>
                <button class="modal-close" onclick="document.getElementById('qrModal').remove()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div style="padding: 2rem;">
                <img src="${qrImageUrl}" alt="QR Code" style="max-width: 200px; border-radius: 8px; background: white; padding: 10px;">
                <p style="margin-top: 1rem; color: var(--text-secondary); font-size: 0.9rem;">
                    Scan this QR code at the desk to check in
                </p>
                <p style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted); word-break: break-all;">
                    ${qrUrl}
                </p>
                <button class="btn btn-primary" style="margin-top: 1rem;" onclick="window.open('${qrImageUrl}', '_blank')">
                    Download QR Code
                </button>
            </div>
        </div>
    `;
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    
    document.body.appendChild(modal);
}

// Mark module as loaded
window.floorPlanLoaded = true;

// Expose functions globally for main.js to call
window.initDesksView = initDesksView;
window.loadDesks = loadDesks;
window.updateFloorSelector = updateFloorSelector;
window.toggleEditMode = toggleEditMode;
window.openDeskModal = openDeskModal;
window.closeDeskModal = closeDeskModal;
window.handleDeskClick = handleDeskClick;
window.selectElement = selectElement;
window.deleteSelectedElement = deleteSelectedElement;
window.handleFloorElementClick = handleFloorElementClick;
window.quickBookDesk = quickBookDesk;
window.showQuickBookModal = showQuickBookModal;
window.cancelBookingFromPopup = cancelBookingFromPopup;
window.cancelDeskBooking = cancelDeskBooking;
window.deleteDesk = deleteDesk;
window.openRoomModal = openRoomModal;
window.closeRoomModal = closeRoomModal;
window.openWallModal = openWallModal;
window.closeWallModal = closeWallModal;
window.openLabelModal = openLabelModal;
window.closeLabelModal = closeLabelModal;
window.openDeskBookingModal = openDeskBookingModal;
window.closeDeskBookingModal = closeDeskBookingModal;
window.showDeskQR = showDeskQR;

console.log('Floor plan module loaded');
