// ============================================
// Office Booking System - Frontend Application
// ============================================

// State
let state = {
    currentDate: new Date(),
    currentLocation: 'jhb',
    locations: [],
    teams: [],
    bookings: [],
    publicHolidays: [],
    selectedDate: null,
    viewers: [],
    myName: null,
    currentRoom: null
};

// Socket.IO connection
let socket = null;

// DOM Elements
const elements = {
    locationSelect: document.getElementById('locationSelect'),
    capacityLabel: document.getElementById('capacityLabel'),
    capacityFill: document.getElementById('capacityFill'),
    currentMonth: document.getElementById('currentMonth'),
    calendarGrid: document.getElementById('calendarGrid'),
    teamsLegend: document.getElementById('teamsLegend'),
    bookingModal: document.getElementById('bookingModal'),
    bookingForm: document.getElementById('bookingForm'),
    teamSelect: document.getElementById('teamSelect'),
    teamModal: document.getElementById('teamModal'),
    teamForm: document.getElementById('teamForm'),
    locationModal: document.getElementById('locationModal'),
    locationForm: document.getElementById('locationForm'),
    toastContainer: document.getElementById('toastContainer')
};

// ============================================
// Initialization
// ============================================

async function init() {
    loadTheme();
    await loadData();
    setupEventListeners();
    renderCalendar();
    updateCapacityDisplay();
    initSocket();
}

// ============================================
// Real-Time Socket.IO
// ============================================

function initSocket() {
    // Prompt for name on first visit
    state.myName = localStorage.getItem('userName');
    if (!state.myName) {
        state.myName = prompt('Enter your name for live presence:') || 'Anonymous';
        localStorage.setItem('userName', state.myName);
    }
    
    // Connect to Socket.IO
    socket = io();
    
    // Handle connection
    socket.on('connect', () => {
        console.log('Connected to real-time server');
        joinCurrentRoom();
    });
    
    // Handle viewers update
    socket.on('viewers', (viewers) => {
        state.viewers = viewers;
        renderViewers();
    });
    
    // Handle booking changes from other users
    socket.on('booking-created', (booking) => {
        // Add to local state if in same location
        if (booking.locationId === state.currentLocation) {
            const exists = state.bookings.find(b => b.id === booking.id);
            if (!exists) {
                state.bookings.push(booking);
                renderCalendar();
                updateCapacityDisplay();
                showToast(`${booking.teamName} booked by another user`, 'success');
            }
        }
    });
    
    socket.on('booking-updated', (booking) => {
        const index = state.bookings.findIndex(b => b.id === booking.id);
        if (index !== -1) {
            state.bookings[index] = booking;
            renderCalendar();
            updateCapacityDisplay();
        }
    });
    
    socket.on('booking-deleted', ({ id }) => {
        state.bookings = state.bookings.filter(b => b.id !== id);
        renderCalendar();
        updateCapacityDisplay();
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from real-time server');
    });
}

function joinCurrentRoom() {
    if (!socket || !socket.connected) return;
    
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    const room = `${state.currentLocation}-${year}-${month}`;
    
    // Leave old room if different
    if (state.currentRoom && state.currentRoom !== room) {
        socket.emit('leave-room', state.currentRoom);
    }
    
    // Join new room
    socket.emit('join-room', { room, name: state.myName });
    state.currentRoom = room;
}

function renderViewers() {
    const avatarsContainer = document.getElementById('presenceAvatars');
    const countEl = document.getElementById('presenceCount');
    if (!avatarsContainer || !countEl) return;
    
    const total = state.viewers.length;
    countEl.textContent = total;
    
    // Filter out self for display
    const others = state.viewers.filter(v => v.name !== state.myName);
    
    if (others.length === 0) {
        avatarsContainer.innerHTML = '<span class="presence-only-you">Only you</span>';
        return;
    }
    
    const maxShow = 5;
    const shown = others.slice(0, maxShow);
    const remaining = others.length - maxShow;
    
    let html = shown.map(v => `
        <div class="presence-avatar" title="${v.name}" style="background: ${stringToColor(v.name)}">
            ${getInitials(v.name)}
        </div>
    `).join('');
    
    if (remaining > 0) {
        html += `<div class="presence-avatar presence-more" title="${remaining} more">+${remaining}</div>`;
    }
    
    avatarsContainer.innerHTML = html;
}

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 65%, 45%)`;
}

// ============================================
// Theme Management
// ============================================

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

async function loadData() {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();
        
        state.locations = data.locations || [];
        state.teams = data.teams || [];
        state.bookings = data.bookings || [];
        state.publicHolidays = data.publicHolidays || [];
        
        // Set default location
        if (state.locations.length > 0 && !state.locations.find(l => l.id === state.currentLocation)) {
            state.currentLocation = state.locations[0].id;
        }
        
        renderLocationSelect();
        renderTeamSelect();
        renderTeamsLegend();
        renderTeamsList();
        renderLocationsList();
        renderHolidaysList();
        renderHolidayYearSelect();
    } catch (error) {
        console.error('Failed to load data:', error);
        showToast('Failed to load data', 'error');
    }
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view));
    });
    
    // Month navigation
    document.getElementById('prevMonth').addEventListener('click', () => navigateMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => navigateMonth(1));
    document.getElementById('todayBtn').addEventListener('click', goToToday);
    
    // Location change
    elements.locationSelect.addEventListener('change', (e) => {
        state.currentLocation = e.target.value;
        renderCalendar();
        updateCapacityDisplay();
        renderTeamsLegend();
        renderTeamSelect();
        joinCurrentRoom();
    });
    
    // Booking form
    elements.bookingForm.addEventListener('submit', handleBookingSubmit);
    
    // Team selection - auto-fill member count
    elements.teamSelect.addEventListener('change', handleTeamSelect);
    
    // Team form
    elements.teamForm.addEventListener('submit', handleTeamSubmit);
    document.getElementById('addTeamBtn').addEventListener('click', () => {
        renderTeamLocationSelect();
        elements.teamModal.classList.add('active');
    });
    
    // Location form
    elements.locationForm.addEventListener('submit', handleLocationSubmit);
    document.getElementById('addLocationBtn').addEventListener('click', () => {
        elements.locationModal.classList.add('active');
    });
    
    // Holidays
    document.getElementById('fetchHolidaysBtn').addEventListener('click', fetchHolidays);
    
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    
    // Close modals on outside click
    [elements.bookingModal, elements.teamModal, elements.locationModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeTeamModal();
            closeLocationModal();
        }
    });
}

// ============================================
// Calendar Rendering
// ============================================

function renderCalendar() {
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    
    // Update header
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    elements.currentMonth.textContent = `${monthNames[month]} ${year}`;
    
    // Get first day of month and total days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0
    const totalDays = lastDay.getDate();
    
    // Get bookings for this month and location
    const monthBookings = state.bookings.filter(b => {
        const date = new Date(b.date);
        return date.getFullYear() === year && 
               date.getMonth() === month && 
               b.locationId === state.currentLocation;
    });
    
    // Get current location capacity
    const location = state.locations.find(l => l.id === state.currentLocation);
    const capacity = location ? location.capacity : 21;
    
    // Build calendar grid
    let html = '';
    const today = new Date();
    
    // Previous month days
    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        const day = prevMonthDays - i;
        html += `<div class="calendar-day other-month"><span class="day-number">${day}</span></div>`;
    }
    
    // Current month days
    for (let day = 1; day <= totalDays; day++) {
        const date = new Date(year, month, day);
        const dateStr = formatDateStr(date);
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isToday = date.toDateString() === today.toDateString();
        const holiday = state.publicHolidays.find(h => h.date === dateStr);
        
        // Get bookings for this day
        const dayBookings = monthBookings.filter(b => b.date === dateStr);
        const totalPeople = dayBookings.reduce((sum, b) => sum + b.peopleCount, 0);
        
        let classes = ['calendar-day'];
        if (isWeekend) classes.push('weekend');
        if (isToday) classes.push('today');
        if (holiday) classes.push('holiday');
        
        let dayContent = `<span class="day-number">${day}</span>`;
        
        // Capacity indicator
        if (!isWeekend && !holiday && totalPeople > 0) {
            let capacityClass = '';
            if (totalPeople >= capacity) capacityClass = 'full';
            else if (totalPeople >= capacity * 0.8) capacityClass = 'warning';
            dayContent += `<span class="day-capacity ${capacityClass}">${totalPeople}/${capacity}</span>`;
        }
        
        // Holiday label
        if (holiday) {
            dayContent += `<span class="holiday-label">${holiday.name}</span>`;
        }
        
        // Booking chips with drag & drop
        if (!isWeekend && !holiday && dayBookings.length > 0) {
            dayContent += '<div class="day-bookings-preview">';
            const maxShow = 3;
            dayBookings.slice(0, maxShow).forEach(booking => {
                const team = state.teams.find(t => t.id === booking.teamId);
                const color = team ? team.color : '#6B7280';
                const teamId = team ? team.id : '';
                dayContent += `
                    <div class="booking-chip" 
                         draggable="true"
                         data-booking-id="${booking.id}"
                         data-team-id="${teamId}"
                         ondragstart="handleDragStart(event, '${booking.id}')"
                         ondragend="handleDragEnd(event)"
                         onmouseenter="showTeamTooltip(event, '${teamId}')"
                         onmouseleave="hideTeamTooltip()">
                        <span class="booking-chip-color" style="background: ${color}"></span>
                        <span>${booking.teamName}</span>
                        <span style="opacity: 0.7">(${booking.peopleCount})</span>
                    </div>
                `;
            });
            if (dayBookings.length > maxShow) {
                dayContent += `<span class="more-bookings">+${dayBookings.length - maxShow} more</span>`;
            }
            dayContent += '</div>';
        }
        
        const clickHandler = !isWeekend && !holiday ? `onclick="openBookingModal('${dateStr}')"` : '';
        const dropHandlers = !isWeekend && !holiday ? `
            ondragover="handleDragOver(event)"
            ondragleave="handleDragLeave(event)"
            ondrop="handleDrop(event, '${dateStr}')"
        ` : '';
        html += `<div class="${classes.join(' ')}" ${clickHandler} ${dropHandlers} data-date="${dateStr}">${dayContent}</div>`;
    }
    
    // Next month days
    const totalCells = startingDayOfWeek + totalDays;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let day = 1; day <= remainingCells; day++) {
        html += `<div class="calendar-day other-month"><span class="day-number">${day}</span></div>`;
    }
    
    elements.calendarGrid.innerHTML = html;
}

function navigateMonth(delta) {
    state.currentDate.setMonth(state.currentDate.getMonth() + delta);
    renderCalendar();
    joinCurrentRoom();
}

function goToToday() {
    state.currentDate = new Date();
    renderCalendar();
    updateCapacityDisplay();
    joinCurrentRoom();
}

// ============================================
// Booking Management
// ============================================

function openBookingModal(dateStr) {
    state.selectedDate = dateStr;
    
    // Format date for display
    const date = new Date(dateStr);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('selectedDate').textContent = date.toLocaleDateString('en-ZA', options);
    document.getElementById('bookingDate').value = dateStr;
    document.getElementById('bookingId').value = '';
    
    // Reset form
    document.getElementById('bookingNotes').value = '';
    document.getElementById('teamSelect').selectedIndex = 0;
    document.getElementById('modalTitle').textContent = 'Book Office Space';
    
    // Trigger team select to set member count
    handleTeamSelect();
    
    // Update available spots hint
    updateAvailableSpotsHint(dateStr);
    
    // Show existing bookings for this day
    renderDayBookings(dateStr);
    
    elements.bookingModal.classList.add('active');
}

function handleTeamSelect() {
    const teamId = document.getElementById('teamSelect').value;
    const team = state.teams.find(t => t.id === teamId);
    
    if (team) {
        const memberCount = team.memberCount || 0;
        const manager = team.manager || 'Not assigned';
        document.getElementById('peopleCount').value = memberCount;
        
        let infoHtml = `<strong>${memberCount}</strong> people · Manager: <strong>${manager}</strong>`;
        
        // Check capacity
        if (state.selectedDate) {
            const location = state.locations.find(l => l.id === state.currentLocation);
            const capacity = location ? location.capacity : 21;
            
            const dayBookings = state.bookings.filter(
                b => b.date === state.selectedDate && b.locationId === state.currentLocation
            );
            const used = dayBookings.reduce((sum, b) => sum + b.peopleCount, 0);
            const available = capacity - used;
            
            if (memberCount > available) {
                infoHtml += `<br><span style="color: var(--danger)">⚠ Exceeds ${available} available spots</span>`;
            }
        }
        
        document.getElementById('teamMemberCount').innerHTML = infoHtml;
    }
}

function closeModal() {
    elements.bookingModal.classList.remove('active');
    state.selectedDate = null;
}

function updateAvailableSpotsHint(dateStr) {
    const location = state.locations.find(l => l.id === state.currentLocation);
    const capacity = location ? location.capacity : 21;
    
    const dayBookings = state.bookings.filter(
        b => b.date === dateStr && b.locationId === state.currentLocation
    );
    const used = dayBookings.reduce((sum, b) => sum + b.peopleCount, 0);
    const available = capacity - used;
    
    document.getElementById('availableSpots').textContent = `Available: ${available} of ${capacity}`;
    document.getElementById('peopleCount').max = available;
}

function renderDayBookings(dateStr) {
    const dayBookings = state.bookings.filter(
        b => b.date === dateStr && b.locationId === state.currentLocation
    );
    
    const container = document.getElementById('dayBookingsList');
    
    if (dayBookings.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No bookings yet</p>';
        return;
    }
    
    container.innerHTML = dayBookings.map(booking => {
        const team = state.teams.find(t => t.id === booking.teamId);
        const color = team ? team.color : '#6B7280';
        const location = state.locations.find(l => l.id === booking.locationId);
        
        return `
            <div class="booking-item">
                <div class="booking-info">
                    <span class="booking-team-color" style="background: ${color}"></span>
                    <span class="booking-team-name">${booking.teamName}</span>
                    <span class="booking-people">${booking.peopleCount} people</span>
                </div>
                <div class="calendar-sync-buttons">
                    <button class="sync-btn google" onclick="addToGoogleCalendar('${booking.id}')" title="Add to Google Calendar">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                    </button>
                    <button class="sync-btn outlook" onclick="addToOutlookCalendar('${booking.id}')" title="Add to Outlook">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zm5 14a4 4 0 100-8 4 4 0 000 8z"/>
                        </svg>
                    </button>
                    <button class="sync-btn ics" onclick="downloadICS('${booking.id}')" title="Download .ics file">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                        </svg>
                    </button>
                </div>
                <div class="booking-actions">
                    <button onclick="editBooking('${booking.id}')" title="Edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="delete" onclick="deleteBooking('${booking.id}')" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function handleBookingSubmit(e) {
    e.preventDefault();
    
    const bookingId = document.getElementById('bookingId').value;
    const date = document.getElementById('bookingDate').value;
    const teamId = document.getElementById('teamSelect').value;
    const team = state.teams.find(t => t.id === teamId);
    const peopleCount = parseInt(document.getElementById('peopleCount').value);
    const notes = document.getElementById('bookingNotes').value;
    
    try {
        if (bookingId) {
            // Update existing booking
            const response = await fetch(`/api/bookings/${bookingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamId, teamName: team?.name, peopleCount, notes })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error);
            }
            
            showToast('Booking updated successfully', 'success');
        } else {
            // Create new booking
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    teamId,
                    teamName: team?.name,
                    peopleCount,
                    locationId: state.currentLocation,
                    notes
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error);
            }
            
            showToast('Booking created successfully', 'success');
        }
        
        await loadData();
        renderCalendar();
        updateCapacityDisplay();
        
        // Keep modal open and refresh bookings
        updateAvailableSpotsHint(date);
        renderDayBookings(date);
        
        // Reset form for new booking
        document.getElementById('bookingId').value = '';
        document.getElementById('peopleCount').value = 1;
        document.getElementById('bookingNotes').value = '';
        document.getElementById('modalTitle').textContent = 'Book Office Space';
        
    } catch (error) {
        showToast(error.message || 'Failed to save booking', 'error');
    }
}

function editBooking(id) {
    const booking = state.bookings.find(b => b.id === id);
    if (!booking) return;
    
    document.getElementById('bookingId').value = booking.id;
    document.getElementById('teamSelect').value = booking.teamId;
    document.getElementById('peopleCount').value = booking.peopleCount;
    document.getElementById('bookingNotes').value = booking.notes || '';
    document.getElementById('modalTitle').textContent = 'Edit Booking';
    
    // Scroll to form
    elements.bookingForm.scrollIntoView({ behavior: 'smooth' });
}

async function deleteBooking(id) {
    if (!confirm('Are you sure you want to delete this booking?')) return;
    
    try {
        const response = await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }
        
        showToast('Booking deleted', 'success');
        
        await loadData();
        renderCalendar();
        updateCapacityDisplay();
        
        if (state.selectedDate) {
            updateAvailableSpotsHint(state.selectedDate);
            renderDayBookings(state.selectedDate);
        }
        
    } catch (error) {
        showToast(error.message || 'Failed to delete booking', 'error');
    }
}

// ============================================
// Capacity Display
// ============================================

function updateCapacityDisplay() {
    const today = formatDateStr(new Date());
    const location = state.locations.find(l => l.id === state.currentLocation);
    const capacity = location ? location.capacity : 21;
    
    const todayBookings = state.bookings.filter(
        b => b.date === today && b.locationId === state.currentLocation
    );
    const used = todayBookings.reduce((sum, b) => sum + b.peopleCount, 0);
    const percentage = Math.min((used / capacity) * 100, 100);
    
    elements.capacityLabel.textContent = `${used}/${capacity}`;
    elements.capacityFill.style.width = `${percentage}%`;
    
    if (percentage >= 80) {
        elements.capacityFill.classList.add('warning');
    } else {
        elements.capacityFill.classList.remove('warning');
    }
}

// ============================================
// Location & Team Management
// ============================================

function renderLocationSelect() {
    elements.locationSelect.innerHTML = state.locations.map(loc => 
        `<option value="${loc.id}" ${loc.id === state.currentLocation ? 'selected' : ''}>${loc.name}</option>`
    ).join('');
}

function renderTeamSelect() {
    // Filter teams by current location
    const locationTeams = state.teams.filter(t => t.locationId === state.currentLocation);
    
    if (locationTeams.length === 0) {
        elements.teamSelect.innerHTML = '<option value="">No teams for this location</option>';
    } else {
        elements.teamSelect.innerHTML = locationTeams.map(team => 
            `<option value="${team.id}">${team.name} (${team.memberCount || 0})</option>`
        ).join('');
    }
}

function renderTeamLocationSelect() {
    const select = document.getElementById('teamLocationSelect');
    if (select) {
        select.innerHTML = state.locations.map(loc => 
            `<option value="${loc.id}">${loc.name}</option>`
        ).join('');
    }
}

function renderTeamsLegend() {
    const container = elements.teamsLegend;
    // Filter teams by current location
    const locationTeams = state.teams.filter(t => t.locationId === state.currentLocation);
    
    if (locationTeams.length === 0) {
        container.innerHTML = `<h4>Teams</h4><p style="font-size: 0.8rem; color: var(--text-muted);">No teams for this location</p>`;
        return;
    }
    
    const legendItems = locationTeams.slice(0, 8).map(team => `
        <div class="team-legend-item">
            <span class="team-color-dot" style="background: ${team.color}"></span>
            <span>${team.name} (${team.memberCount || 0})</span>
        </div>
    `).join('');
    
    const moreCount = locationTeams.length > 8 ? `<p style="font-size: 0.75rem; color: var(--text-muted);">+${locationTeams.length - 8} more</p>` : '';
    
    container.innerHTML = `<h4>Teams</h4>${legendItems}${moreCount}`;
}

function renderTeamsList() {
    const container = document.getElementById('teamsList');
    
    // Group teams by location
    const teamsByLocation = {};
    state.teams.forEach(team => {
        const locId = team.locationId || 'unassigned';
        if (!teamsByLocation[locId]) teamsByLocation[locId] = [];
        teamsByLocation[locId].push(team);
    });
    
    let html = '';
    
    state.locations.forEach(location => {
        const locationTeams = teamsByLocation[location.id] || [];
        if (locationTeams.length === 0) return;
        
        html += `<div class="teams-location-group">
            <h3 class="teams-location-header">${location.name} <span class="team-count">(${locationTeams.length} teams)</span></h3>
            <div class="teams-grid">`;
        
        locationTeams.forEach(team => {
            const avatarContent = getAvatarHTML(team.manager, team.managerImage, team.color);
            html += `
                <div class="team-card" style="border-left: 4px solid ${team.color};">
                    <div class="team-card-header">
                        <div class="team-card-info">
                            <div class="team-card-avatar" style="background: ${team.managerImage ? 'transparent' : `linear-gradient(135deg, ${team.color}, ${adjustColor(team.color, -30)})`}">
                                ${avatarContent}
                            </div>
                            <div class="team-card-details">
                                <div class="team-name">${team.name}</div>
                                <div class="team-manager-name">${team.manager || 'No manager assigned'}</div>
                                <div class="team-meta">
                                    <span class="team-meta-item">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="9" cy="7" r="4"></circle>
                                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                        </svg>
                                        ${team.memberCount || 0} members
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div class="team-card-actions">
                            <button class="btn btn-small btn-secondary" onclick="editTeam('${team.id}')">Edit</button>
                            <button class="btn btn-small btn-danger" onclick="deleteTeam('${team.id}')">Delete</button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div></div>';
    });
    
    if (html === '') {
        html = '<p style="color: var(--text-muted);">No teams created yet. Click "Add Team" to create one.</p>';
    }
    
    container.innerHTML = html;
}

function getAvatarHTML(managerName, imageUrl, color) {
    if (imageUrl) {
        return `<img src="${imageUrl}" alt="${managerName || 'Manager'}" onerror="this.style.display='none'; this.parentElement.innerHTML='${getInitials(managerName)}';">`;
    }
    return getInitials(managerName);
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function renderLocationsList() {
    const container = document.getElementById('locationsList');
    container.innerHTML = state.locations.map(loc => `
        <div class="location-card">
            <div class="location-card-header">
                <div class="location-card-info">
                    <div class="location-name">${loc.name}</div>
                    <p class="location-capacity-info">Max Capacity: ${loc.capacity} people per day</p>
                </div>
                <div class="location-card-actions">
                    <button class="btn btn-small btn-secondary" onclick="editLocation('${loc.id}')">Edit</button>
                    <button class="btn btn-small btn-danger" onclick="deleteLocation('${loc.id}')">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function handleTeamSubmit(e) {
    e.preventDefault();
    
    const editTeamId = document.getElementById('editTeamId').value;
    const locationId = document.getElementById('teamLocationSelect').value;
    const name = document.getElementById('teamName').value;
    const manager = document.getElementById('teamManager').value;
    const managerImage = document.getElementById('teamManagerImage').value;
    const color = document.getElementById('teamColor').value;
    const memberCount = parseInt(document.getElementById('teamMemberCountInput').value);
    
    try {
        let response;
        
        if (editTeamId) {
            // Update existing team
            response = await fetch(`/api/teams/${editTeamId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, manager, managerImage, color, memberCount, locationId })
            });
        } else {
            // Create new team
            response = await fetch('/api/teams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, manager, managerImage, color, memberCount, locationId })
            });
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }
        
        showToast(editTeamId ? 'Team updated successfully' : 'Team created successfully', 'success');
        closeTeamModal();
        
        await loadData();
        renderTeamsList();
        
    } catch (error) {
        showToast(error.message || 'Failed to save team', 'error');
    }
}

function editTeam(id) {
    const team = state.teams.find(t => t.id === id);
    if (!team) return;
    
    renderTeamLocationSelect();
    
    document.getElementById('editTeamId').value = team.id;
    document.getElementById('teamLocationSelect').value = team.locationId || state.locations[0]?.id;
    document.getElementById('teamName').value = team.name;
    document.getElementById('teamManager').value = team.manager || '';
    document.getElementById('teamManagerImage').value = team.managerImage || '';
    document.getElementById('teamMemberCountInput').value = team.memberCount || 0;
    document.getElementById('teamColor').value = team.color;
    document.getElementById('teamFormSubmitBtn').textContent = 'Save Changes';
    document.querySelector('#teamModal .modal-header h2').textContent = 'Edit Team';
    
    elements.teamModal.classList.add('active');
}

async function handleLocationSubmit(e) {
    e.preventDefault();
    
    const editLocationId = document.getElementById('editLocationId').value;
    const name = document.getElementById('locationName').value;
    const capacity = parseInt(document.getElementById('locationCapacity').value);
    
    try {
        let response;
        
        if (editLocationId) {
            // Update existing location
            response = await fetch(`/api/locations/${editLocationId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, capacity })
            });
        } else {
            // Create new location
            response = await fetch('/api/locations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, capacity })
            });
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }
        
        showToast(editLocationId ? 'Location updated successfully' : 'Location created successfully', 'success');
        closeLocationModal();
        
        await loadData();
        renderLocationsList();
        renderLocationSelect();
        renderCalendar();
        updateCapacityDisplay();
        
    } catch (error) {
        showToast(error.message || 'Failed to save location', 'error');
    }
}

function editLocation(id) {
    const location = state.locations.find(l => l.id === id);
    if (!location) return;
    
    document.getElementById('editLocationId').value = location.id;
    document.getElementById('locationName').value = location.name;
    document.getElementById('locationCapacity').value = location.capacity;
    document.getElementById('locationFormSubmitBtn').textContent = 'Save Changes';
    document.getElementById('locationModalTitle').textContent = 'Edit Location';
    
    elements.locationModal.classList.add('active');
}

async function deleteTeam(id) {
    if (!confirm('Are you sure you want to delete this team?')) return;
    
    try {
        await fetch(`/api/teams/${id}`, { method: 'DELETE' });
        showToast('Team deleted', 'success');
        
        await loadData();
        renderTeamsList();
        
    } catch (error) {
        showToast('Failed to delete team', 'error');
    }
}

async function deleteLocation(id) {
    if (!confirm('Delete this location? All bookings for this location will also be deleted.')) return;
    
    try {
        await fetch(`/api/locations/${id}`, { method: 'DELETE' });
        showToast('Location deleted', 'success');
        
        // Switch to first remaining location
        await loadData();
        if (state.locations.length > 0 && !state.locations.find(l => l.id === state.currentLocation)) {
            state.currentLocation = state.locations[0].id;
        }
        
        renderLocationsList();
        renderLocationSelect();
        renderCalendar();
        
    } catch (error) {
        showToast('Failed to delete location', 'error');
    }
}

function closeTeamModal() {
    elements.teamModal.classList.remove('active');
    elements.teamForm.reset();
    document.getElementById('editTeamId').value = '';
    document.getElementById('teamManager').value = '';
    document.getElementById('teamManagerImage').value = '';
    document.getElementById('teamFormSubmitBtn').textContent = 'Add Team';
    document.querySelector('#teamModal .modal-header h2').textContent = 'Add Team';
}

// ============================================
// Team Tooltip
// ============================================

let tooltipTimeout = null;

function showTeamTooltip(event, teamId) {
    const team = state.teams.find(t => t.id === teamId);
    if (!team) return;
    
    const tooltip = document.getElementById('teamTooltip');
    const avatarEl = document.getElementById('tooltipAvatar');
    const teamNameEl = document.getElementById('tooltipTeamName');
    const managerEl = document.getElementById('tooltipManager');
    const membersEl = document.getElementById('tooltipMembers');
    
    // Set content
    teamNameEl.textContent = team.name;
    managerEl.textContent = team.manager ? `SM: ${team.manager}` : 'No manager assigned';
    membersEl.textContent = `${team.memberCount || 0} team members`;
    
    // Set avatar
    if (team.managerImage) {
        avatarEl.innerHTML = `<img src="${team.managerImage}" alt="${team.manager || 'Manager'}" onerror="this.parentElement.innerHTML='${getInitials(team.manager)}';">`;
        avatarEl.style.background = 'transparent';
    } else {
        avatarEl.innerHTML = getInitials(team.manager);
        avatarEl.style.background = `linear-gradient(135deg, ${team.color}, ${adjustColor(team.color, -30)})`;
    }
    
    // Position tooltip
    const rect = event.target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    let left = rect.left + rect.width / 2;
    let top = rect.bottom + 8;
    
    // Adjust if tooltip would go off screen
    if (left + 120 > window.innerWidth) {
        left = window.innerWidth - 130;
    }
    if (left < 10) {
        left = 10;
    }
    if (top + 100 > window.innerHeight) {
        top = rect.top - 100;
    }
    
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    
    // Show with slight delay for smoother UX
    clearTimeout(tooltipTimeout);
    tooltipTimeout = setTimeout(() => {
        tooltip.classList.add('visible');
    }, 100);
}

function hideTeamTooltip() {
    clearTimeout(tooltipTimeout);
    const tooltip = document.getElementById('teamTooltip');
    tooltip.classList.remove('visible');
}

function adjustColor(color, amount) {
    // Darken or lighten a hex color
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function closeLocationModal() {
    elements.locationModal.classList.remove('active');
    elements.locationForm.reset();
    document.getElementById('editLocationId').value = '';
    document.getElementById('locationFormSubmitBtn').textContent = 'Add Location';
    document.getElementById('locationModalTitle').textContent = 'Add Location';
}

// ============================================
// Holidays Management
// ============================================

function renderHolidayYearSelect() {
    const select = document.getElementById('holidayYear');
    const currentYear = new Date().getFullYear();
    
    select.innerHTML = '';
    for (let year = currentYear; year <= currentYear + 3; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
    }
}

function renderHolidaysList() {
    const container = document.getElementById('holidaysList');
    
    if (state.publicHolidays.length === 0) {
        container.innerHTML = '<div class="no-holidays">No holidays configured. Click "Fetch SA Holidays" to load public holidays.</div>';
        return;
    }
    
    // Group by year
    const byYear = {};
    state.publicHolidays.forEach(h => {
        const year = h.date.substring(0, 4);
        if (!byYear[year]) byYear[year] = [];
        byYear[year].push(h);
    });
    
    let html = '';
    Object.keys(byYear).sort().reverse().forEach(year => {
        html += `<div class="holidays-year-group"><h3>${year}</h3><div class="holidays-list">`;
        byYear[year].forEach(holiday => {
            const date = new Date(holiday.date);
            const formattedDate = date.toLocaleDateString('en-ZA', { 
                weekday: 'short', 
                day: 'numeric', 
                month: 'short' 
            });
            html += `
                <div class="holiday-item">
                    <div class="holiday-info">
                        <span class="holiday-date">${formattedDate}</span>
                        <span class="holiday-name">${holiday.name}</span>
                    </div>
                    <button class="delete-btn" onclick="deleteHoliday('${holiday.date}')" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;
        });
        html += '</div></div>';
    });
    
    container.innerHTML = html;
}

async function fetchHolidays() {
    const year = document.getElementById('holidayYear').value;
    const btn = document.getElementById('fetchHolidaysBtn');
    
    btn.disabled = true;
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
        </svg>
        Fetching...
    `;
    
    try {
        // Fetch from API
        const response = await fetch(`/api/holidays/fetch/${year}?country=ZA`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch holidays');
        }
        
        const holidays = await response.json();
        
        // Save to database
        const saveResponse = await fetch('/api/holidays', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ holidays })
        });
        
        if (!saveResponse.ok) {
            throw new Error('Failed to save holidays');
        }
        
        showToast(`Loaded ${holidays.length} holidays for ${year}`, 'success');
        
        await loadData();
        renderCalendar();
        
    } catch (error) {
        console.error('Error fetching holidays:', error);
        showToast('Failed to fetch holidays. Check your internet connection.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9"></path>
            </svg>
            Fetch SA Holidays
        `;
    }
}

async function deleteHoliday(date) {
    if (!confirm('Remove this holiday?')) return;
    
    try {
        await fetch(`/api/holidays/${date}`, { method: 'DELETE' });
        showToast('Holiday removed', 'success');
        
        await loadData();
        renderCalendar();
        
    } catch (error) {
        showToast('Failed to delete holiday', 'error');
    }
}

// ============================================
// View Switching
// ============================================

function switchView(viewName) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewName);
    });
    
    // Update views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.toggle('active', view.id === `${viewName}View`);
    });
}

// ============================================
// Utilities
// ============================================

function formatDateStr(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">
            ${type === 'success' 
                ? '<polyline points="20 6 9 17 4 12"></polyline>'
                : '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>'
            }
        </svg>
        <span>${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// Drag & Drop
// ============================================

let draggedBookingId = null;

function handleDragStart(event, bookingId) {
    draggedBookingId = bookingId;
    event.target.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', bookingId);
    
    // Hide tooltip while dragging
    hideTeamTooltip();
}

function handleDragEnd(event) {
    event.target.classList.remove('dragging');
    draggedBookingId = null;
    
    // Remove drag-over class from all days
    document.querySelectorAll('.calendar-day.drag-over').forEach(day => {
        day.classList.remove('drag-over');
    });
}

function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    
    const dayElement = event.target.closest('.calendar-day');
    if (dayElement && !dayElement.classList.contains('weekend') && !dayElement.classList.contains('holiday') && !dayElement.classList.contains('other-month')) {
        dayElement.classList.add('drag-over');
    }
}

function handleDragLeave(event) {
    const dayElement = event.target.closest('.calendar-day');
    if (dayElement) {
        dayElement.classList.remove('drag-over');
    }
}

async function handleDrop(event, targetDate) {
    event.preventDefault();
    
    const dayElement = event.target.closest('.calendar-day');
    if (dayElement) {
        dayElement.classList.remove('drag-over');
    }
    
    if (!draggedBookingId) return;
    
    const booking = state.bookings.find(b => b.id === draggedBookingId);
    if (!booking) return;
    
    // Don't do anything if dropping on the same date
    if (booking.date === targetDate) return;
    
    try {
        const response = await fetch(`/api/bookings/${draggedBookingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: targetDate })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }
        
        showToast(`Moved ${booking.teamName} to ${formatDisplayDate(targetDate)}`, 'success');
        
        await loadData();
        renderCalendar();
        
    } catch (error) {
        showToast(error.message || 'Failed to move booking', 'error');
    }
    
    draggedBookingId = null;
}

function formatDisplayDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ============================================
// Calendar Sync
// ============================================

function addToGoogleCalendar(bookingId) {
    const booking = state.bookings.find(b => b.id === bookingId);
    if (!booking) return;
    
    const location = state.locations.find(l => l.id === booking.locationId);
    const team = state.teams.find(t => t.id === booking.teamId);
    
    const startDate = booking.date.replace(/-/g, '');
    const title = encodeURIComponent(`${booking.teamName} - Office Booking`);
    const details = encodeURIComponent(`Team: ${booking.teamName}\nPeople: ${booking.peopleCount}\nManager: ${team?.manager || 'N/A'}\n${booking.notes || ''}`);
    const locationText = encodeURIComponent(location?.name || 'Office');
    
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${startDate}&details=${details}&location=${locationText}`;
    
    window.open(url, '_blank');
}

function addToOutlookCalendar(bookingId) {
    const booking = state.bookings.find(b => b.id === bookingId);
    if (!booking) return;
    
    const location = state.locations.find(l => l.id === booking.locationId);
    const team = state.teams.find(t => t.id === booking.teamId);
    
    const title = encodeURIComponent(`${booking.teamName} - Office Booking`);
    const body = encodeURIComponent(`Team: ${booking.teamName}\nPeople: ${booking.peopleCount}\nManager: ${team?.manager || 'N/A'}\n${booking.notes || ''}`);
    const locationText = encodeURIComponent(location?.name || 'Office');
    const startDate = booking.date;
    
    // Outlook Web URL
    const url = `https://outlook.office.com/calendar/0/deeplink/compose?subject=${title}&body=${body}&location=${locationText}&startdt=${startDate}&allday=true`;
    
    window.open(url, '_blank');
}

function downloadICS(bookingId) {
    // Download ICS file from server
    window.location.href = `/api/bookings/${bookingId}/ics`;
}

// ============================================
// Initialize Application
// ============================================

document.addEventListener('DOMContentLoaded', init);

