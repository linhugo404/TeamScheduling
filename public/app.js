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
    myUserId: null,
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
    
    // Handle presence update (viewers list)
    socket.on('presence:update', ({ roomKey, viewers }) => {
        state.viewers = viewers;
        renderViewers();
    });
    
    // Handle data changes from other users
    socket.on('data:changed', ({ type, booking, before }) => {
        console.log('Received data:changed', type, booking);
        
        if (type === 'booking:created' && booking) {
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
        } else if (type === 'booking:updated' && booking) {
            const index = state.bookings.findIndex(b => b.id === booking.id);
            if (index !== -1) {
                state.bookings[index] = booking;
                renderCalendar();
                updateCapacityDisplay();
                showToast(`${booking.teamName} updated`, 'success');
            } else if (booking.locationId === state.currentLocation) {
                // Booking moved to this month
                state.bookings.push(booking);
                renderCalendar();
                updateCapacityDisplay();
            }
        } else if (type === 'booking:moved_out' && booking) {
            // Booking was moved out of this month/location
            state.bookings = state.bookings.filter(b => b.id !== booking.id);
            renderCalendar();
            updateCapacityDisplay();
        } else if (type === 'booking:deleted' && booking) {
            const hadBooking = state.bookings.some(b => b.id === booking.id);
            state.bookings = state.bookings.filter(b => b.id !== booking.id);
            if (hadBooking) {
                renderCalendar();
                updateCapacityDisplay();
                showToast(`${booking.teamName} removed`, 'success');
            }
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from real-time server');
        state.viewers = [];
        renderViewers();
    });
}

function joinCurrentRoom() {
    if (!socket || !socket.connected) return;
    
    const year = state.currentDate.getFullYear();
    const month = String(state.currentDate.getMonth() + 1).padStart(2, '0');
    const roomKey = `presence:${state.currentLocation}:${year}-${month}`;
    
    // Leave old room if different
    if (state.currentRoom && state.currentRoom !== roomKey) {
        socket.emit('presence:leave', { roomKey: state.currentRoom });
    }
    
    // Generate a unique user ID if we don't have one
    if (!state.myUserId) {
        state.myUserId = 'user-' + Math.random().toString(36).substr(2, 9);
    }
    
    // Join new room
    socket.emit('presence:join', { 
        roomKey, 
        user: { 
            id: state.myUserId, 
            name: state.myName 
        } 
    });
    state.currentRoom = roomKey;
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
    // Navigation - skip submenu toggles (items without data-view)
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view));
    });
    
    // Settings submenu toggle
    setupSettingsSubmenu();
    
    // Month navigation
    document.getElementById('prevMonth').addEventListener('click', () => navigateMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => navigateMonth(1));
    document.getElementById('todayBtn').addEventListener('click', goToToday);
    
    // Location change
    elements.locationSelect.addEventListener('change', (e) => {
        state.currentLocation = e.target.value;
        renderCalendar();
        updateCapacityDisplay();
        renderTeamSelect();
        joinCurrentRoom();
        
        // Reload desks if desks view is active
        if (document.getElementById('desksView').classList.contains('active')) {
            updateFloorSelector();
            loadDesks();
        }
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
    document.getElementById('mobileThemeToggle')?.addEventListener('click', toggleTheme);
    
    // Mobile menu
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const sidebar = document.getElementById('sidebar');
    
    mobileMenuBtn?.addEventListener('click', () => {
        sidebar?.classList.toggle('open');
        mobileOverlay?.classList.toggle('active');
        document.body.classList.toggle('menu-open');
    });
    
    mobileOverlay?.addEventListener('click', () => {
        sidebar?.classList.remove('open');
        mobileOverlay?.classList.remove('active');
        document.body.classList.remove('menu-open');
    });
    
    // Close mobile menu when navigating
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            sidebar?.classList.remove('open');
            mobileOverlay?.classList.remove('active');
            document.body.classList.remove('menu-open');
        });
    });
    
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
        const totalPeople = dayBookings.reduce((sum, b) => sum + getBookingPeopleCount(b), 0);
        
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
        
        // Booking chips with drag & drop (sorted by team name)
        if (!isWeekend && !holiday && dayBookings.length > 0) {
            dayContent += '<div class="day-bookings-preview">';
            const maxShow = 5;
            const sortedDayBookings = [...dayBookings].sort((a, b) => {
                const teamA = state.teams.find(t => t.id === a.teamId);
                const teamB = state.teams.find(t => t.id === b.teamId);
                const nameA = teamA ? teamA.name : a.teamName || '';
                const nameB = teamB ? teamB.name : b.teamName || '';
                return nameA.localeCompare(nameB);
            });
            sortedDayBookings.slice(0, maxShow).forEach(booking => {
                const team = state.teams.find(t => t.id === booking.teamId);
                const color = team ? team.color : '#6B7280';
                const teamId = team ? team.id : '';
                // Use current team name and member count, fallback to booking data
                const displayName = team ? team.name : booking.teamName;
                const displayCount = team ? team.memberCount : booking.peopleCount;
                dayContent += `
                    <div class="booking-chip" 
                         draggable="true"
                         data-booking-id="${booking.id}"
                         data-team-id="${teamId}"
                         style="background: ${color};"
                         ondragstart="handleDragStart(event, this.dataset.bookingId)"
                         ondragend="handleDragEnd(event)"
                         onmouseenter="showTeamTooltip(event, this.dataset.teamId)"
                         onmouseleave="hideTeamTooltip()">
                        <span>${displayName}</span>
                        <span style="opacity: 0.8">(${displayCount})</span>
                    </div>
                `;
            });
            if (sortedDayBookings.length > maxShow) {
                dayContent += `<span class="more-bookings">+${sortedDayBookings.length - maxShow} more</span>`;
            }
            dayContent += '</div>';
        }
        
        const clickHandler = !isWeekend && !holiday ? `onclick="openBookingModal('${dateStr}')"` : '';
        const dropHandlers = !isWeekend && !holiday ? `
            ondragover="handleDragOver(event)"
            ondragleave="handleDragLeave(event)"
            ondrop="handleDrop(event, '${dateStr}')"
        ` : '';
        const bookingCount = dayBookings.length;
        html += `<div class="${classes.join(' ')}" ${clickHandler} ${dropHandlers} data-date="${dateStr}" data-booking-count="${bookingCount}">${dayContent}</div>`;
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
            const used = dayBookings.reduce((sum, b) => sum + getBookingPeopleCount(b), 0);
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
    const used = dayBookings.reduce((sum, b) => sum + getBookingPeopleCount(b), 0);
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
    
    // Sort bookings by team name alphabetically
    const sortedBookings = [...dayBookings].sort((a, b) => {
        const teamA = state.teams.find(t => t.id === a.teamId);
        const teamB = state.teams.find(t => t.id === b.teamId);
        const nameA = teamA ? teamA.name : a.teamName || '';
        const nameB = teamB ? teamB.name : b.teamName || '';
        return nameA.localeCompare(nameB);
    });
    
    container.innerHTML = sortedBookings.map(booking => {
        const team = state.teams.find(t => t.id === booking.teamId);
        const color = team ? team.color : '#6B7280';
        const location = state.locations.find(l => l.id === booking.locationId);
        // Use current team name and member count, fallback to booking data
        const displayName = team ? team.name : booking.teamName;
        const displayCount = team ? team.memberCount : booking.peopleCount;
        
        return `
            <div class="booking-item" style="background: ${color}; border-left: none;">
                <div class="booking-info">
                    <span class="booking-team-name" style="color: white;">${displayName}</span>
                    <span class="booking-people" style="color: rgba(255,255,255,0.8);">${displayCount} people</span>
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
    const used = todayBookings.reduce((sum, b) => sum + getBookingPeopleCount(b), 0);
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
    const sortedLocations = [...state.locations].sort((a, b) => a.name.localeCompare(b.name));
    elements.locationSelect.innerHTML = sortedLocations.map(loc => 
        `<option value="${loc.id}" ${loc.id === state.currentLocation ? 'selected' : ''}>${loc.name}</option>`
    ).join('');
}

function renderTeamSelect() {
    // Filter teams by current location and sort alphabetically
    const locationTeams = state.teams
        .filter(t => t.locationId === state.currentLocation)
        .sort((a, b) => a.name.localeCompare(b.name));
    
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
        const sortedLocations = [...state.locations].sort((a, b) => a.name.localeCompare(b.name));
        select.innerHTML = sortedLocations.map(loc => 
            `<option value="${loc.id}">${loc.name}</option>`
        ).join('');
    }
}

function setupSettingsSubmenu() {
    const settingsToggle = document.getElementById('settingsToggle');
    const settingsSubmenu = document.getElementById('settingsSubmenu');
    
    if (settingsToggle && settingsSubmenu) {
        settingsToggle.addEventListener('click', () => {
            settingsToggle.classList.toggle('expanded');
            settingsSubmenu.classList.toggle('open');
        });
    }
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
    
    // Sort locations alphabetically
    const sortedLocations = [...state.locations].sort((a, b) => a.name.localeCompare(b.name));
    
    sortedLocations.forEach(location => {
        const locationTeams = (teamsByLocation[location.id] || [])
            .sort((a, b) => a.name.localeCompare(b.name)); // Sort teams alphabetically
        if (locationTeams.length === 0) return;
        
        html += `<div class="teams-location-group">
            <h3 class="teams-location-header">${location.name} <span class="team-count">(${locationTeams.length} teams)</span></h3>
            <div class="teams-grid">`;
        
        locationTeams.forEach(team => {
            const avatarContent = getAvatarHTML(team.manager, team.managerImage, team.color);
            html += `
                <div class="team-card">
                    <div class="team-card-color-bar" style="background: ${team.color};"></div>
                    <div class="team-card-avatar-wrapper">
                        <div class="team-card-avatar" style="background: ${team.managerImage ? 'transparent' : `linear-gradient(135deg, ${team.color}, ${adjustColor(team.color, -30)})`}; border-color: ${team.color};">
                            ${avatarContent}
                        </div>
                    </div>
                    <div class="team-card-body">
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
                                ${team.memberCount || 0} member${team.memberCount !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                    <div class="team-card-actions">
                        <button class="btn btn-small btn-secondary" data-team-id="${team.id}" onclick="editTeam(this.dataset.teamId)">Edit</button>
                        <button class="btn btn-small btn-danger" data-team-id="${team.id}" onclick="deleteTeam(this.dataset.teamId)">Delete</button>
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
    const sortedLocations = [...state.locations].sort((a, b) => a.name.localeCompare(b.name));
    container.innerHTML = sortedLocations.map(loc => {
        const hasAddress = loc.address && loc.address.trim();
        const mapsLink = hasAddress
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}`
            : '#';
        
        return `
            <div class="location-card">
                ${hasAddress ? `
                    <div class="location-map" id="map-${loc.id}" data-address="${encodeURIComponent(loc.address)}">
                        <div class="map-loading">
                            <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                            </svg>
                            Loading map...
                        </div>
                        <a href="${mapsLink}" target="_blank" class="map-overlay-link" title="Open in Google Maps">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                        </a>
                    </div>
                ` : `
                    <div class="location-map location-map-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        <span>No address set</span>
                    </div>
                `}
                <div class="location-card-body">
                    <div class="location-name">${loc.name}</div>
                    ${hasAddress ? `<div class="location-address">${loc.address}</div>` : ''}
                    <div class="location-meta">
                        <span class="location-meta-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                            ${loc.capacity} capacity
                        </span>
                        <span class="location-meta-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="3" y1="9" x2="21" y2="9"></line>
                                <line x1="3" y1="15" x2="21" y2="15"></line>
                            </svg>
                            ${loc.floors || 1} floor${(loc.floors || 1) > 1 ? 's' : ''}
                        </span>
                    </div>
                </div>
                <div class="location-card-actions">
                    <button class="btn btn-small btn-secondary" data-loc-id="${loc.id}" onclick="editLocation(this.dataset.locId)">Edit</button>
                    <button class="btn btn-small btn-danger" data-loc-id="${loc.id}" onclick="deleteLocation(this.dataset.locId)">Delete</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Initialize maps (will only actually create maps if containers are visible and have dimensions)
    initializeLocationMaps();
}

// Map instances storage
const locationMaps = new Map();

async function initializeLocationMaps() {
    const mapContainers = document.querySelectorAll('.location-map[data-address]');
    if (mapContainers.length === 0) return;
    
    // Check if the settings view is visible - if not, skip initialization
    const settingsView = document.getElementById('settingsView');
    if (!settingsView?.classList.contains('active')) return;
    
    for (const container of mapContainers) {
        const address = decodeURIComponent(container.dataset.address);
        const mapId = container.id;
        
        // Skip if this map is already initialized (check for leaflet container or error state)
        if (container.querySelector('.leaflet-container') || container.querySelector('.location-map-empty')) {
            continue;
        }
        
        // Skip if container has no dimensions
        if (container.offsetWidth === 0 || container.offsetHeight === 0) {
            continue;
        }
        
        try {
            // Geocode the address using Nominatim (free) with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
            
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
                { signal: controller.signal }
            );
            clearTimeout(timeoutId);
            const data = await response.json();
            
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                
                // Create a dedicated map div inside the container
                container.innerHTML = `
                    <div id="${mapId}-leaflet" style="width: 100%; height: 100%;"></div>
                    <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}" target="_blank" class="map-overlay-link" title="Open in Google Maps">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                    </a>
                `;
                
                // Small delay to ensure DOM is ready
                await new Promise(resolve => setTimeout(resolve, 50));
                
                // Create Leaflet map with dark tiles
                const mapElement = document.getElementById(`${mapId}-leaflet`);
                if (!mapElement) continue;
                
                // Clean up existing map instance if it exists
                if (locationMaps.has(mapId)) {
                    try { locationMaps.get(mapId).remove(); } catch (e) {}
                    locationMaps.delete(mapId);
                }
                
                const map = L.map(mapElement, {
                    zoomControl: false,
                    attributionControl: false,
                    dragging: false,
                    scrollWheelZoom: false,
                    doubleClickZoom: false,
                    touchZoom: false
                }).setView([lat, lon], 16);
                
                // Dark tile layer from CartoDB
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    maxZoom: 19,
                    attribution: ''
                }).addTo(map);
                
                // Custom orange marker using L.icon with SVG data URL
                const markerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" width="32" height="42"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20c0-6.6-5.4-12-12-12z" fill="%23d95c02"/><circle cx="12" cy="12" r="5" fill="white"/></svg>`;
                const iconUrl = `data:image/svg+xml,${encodeURIComponent(markerSvg)}`;
                
                const orangeIcon = L.icon({
                    iconUrl: iconUrl,
                    iconSize: [32, 42],
                    iconAnchor: [16, 42],
                    popupAnchor: [0, -42]
                });
                
                L.marker([lat, lon], { icon: orangeIcon }).addTo(map);
                
                // Force a resize after a short delay
                setTimeout(() => map.invalidateSize(), 100);
                
                locationMaps.set(mapId, map);
            } else {
                container.innerHTML = `
                    <div class="location-map-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        <span>Address not found</span>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to load map for:', address, error);
            container.innerHTML = `
                <div class="location-map-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span>Map unavailable</span>
                </div>
            `;
        }
    }
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
        renderTeamSelect();
        renderCalendar();
        updateCapacityDisplay();
        
    } catch (error) {
        showToast(error.message || 'Failed to save team', 'error');
    }
}

function editTeam(id) {
    const team = state.teams.find(t => t.id === id);
    if (!team) {
        showToast('Team not found. Please refresh the page.', 'error');
        return;
    }
    
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
    const address = document.getElementById('locationAddress').value;
    const capacity = parseInt(document.getElementById('locationCapacity').value);
    const floors = parseInt(document.getElementById('locationFloors').value) || 1;
    
    try {
        let response;
        
        if (editLocationId) {
            // Update existing location
            response = await fetch(`/api/locations/${editLocationId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, address, capacity, floors })
            });
        } else {
            // Create new location
            response = await fetch('/api/locations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, address, capacity, floors })
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
    document.getElementById('locationAddress').value = location.address || '';
    document.getElementById('locationCapacity').value = location.capacity;
    document.getElementById('locationFloors').value = location.floors || 1;
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
        renderTeamSelect();
        renderCalendar();
        updateCapacityDisplay();
        
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
    document.getElementById('locationAddress').value = '';
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
        // Sort holidays by date within each year
        const sortedHolidays = byYear[year].sort((a, b) => a.date.localeCompare(b.date));
        html += `<div class="holidays-year-group"><h3>${year}</h3><div class="holidays-list">`;
        sortedHolidays.forEach(holiday => {
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
    
    // Initialize desks view when selected
    if (viewName === 'desks') {
        initDesksView();
    }
    
    // Re-render locations when settings view becomes visible to initialize maps
    if (viewName === 'settings') {
        // Small delay to ensure the view is fully visible and has dimensions
        setTimeout(() => {
            renderLocationsList();
        }, 200);
    }
}

// ============================================
// Utilities
// ============================================

// Get effective people count for a booking (uses current team memberCount if available)
function getBookingPeopleCount(booking) {
    const team = state.teams.find(t => t.id === booking.teamId);
    return team ? team.memberCount : booking.peopleCount;
}

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
    
    // Store original date for potential rollback
    const originalDate = booking.date;
    const movedBookingId = draggedBookingId;
    const teamName = booking.teamName;
    
    // Optimistically update the booking's date in local state
    booking.date = targetDate;
    
    // Re-render calendar immediately to show the booking in its new position
    renderCalendar();
    
    // Add loading state to the moved booking chip
    const movedChip = document.querySelector(`.booking-chip[data-booking-id="${movedBookingId}"]`);
    if (movedChip) {
        movedChip.classList.add('updating');
    }
    
    try {
        const response = await fetch(`/api/bookings/${movedBookingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: targetDate })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }
        
        showToast(`Moved ${teamName} to ${formatDisplayDate(targetDate)}`, 'success');
        
        // Refresh data to confirm server state
        await loadData();
        renderCalendar();
        
    } catch (error) {
        // Rollback on error
        booking.date = originalDate;
        renderCalendar();
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
// Desk Booking System
// ============================================

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
            `<option value="${t.id}">${t.name}</option>`
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
    const myName = localStorage.getItem('employeeName') || '';
    
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
    
    // Check if user has saved their info
    const savedName = localStorage.getItem('employeeName');
    
    if (savedName) {
        // Quick book with saved info
        quickBookDesk(desk);
    } else {
        // First time - show quick setup modal
        showQuickBookModal(desk);
    }
}

// Show booking info popup for booked desks
function showBookingInfoPopup(desk, booking) {
    const location = state.locations.find(l => l.id === desk.locationId);
    const team = booking.teamId ? state.teams.find(t => t.id === booking.teamId) : null;
    const savedName = localStorage.getItem('employeeName');
    const isOwnBooking = savedName && booking.employeeName.toLowerCase() === savedName.toLowerCase();
    
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

// Quick book a desk with saved info
async function quickBookDesk(desk) {
    const savedName = localStorage.getItem('employeeName');
    const savedEmail = localStorage.getItem('employeeEmail') || '';
    const savedTeamId = localStorage.getItem('employeeTeamId') || null;
    
    // Show loading state on desk
    const deskEl = document.getElementById(`desk-${desk.id}`);
    if (deskEl) deskEl.classList.add('booking');
    
    try {
        const response = await fetch('/api/desk-bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

// Show quick book modal for first-time users
function showQuickBookModal(desk) {
    const savedTeamId = localStorage.getItem('employeeTeamId');
    
    const popup = document.createElement('div');
    popup.className = 'desk-info-popup';
    popup.innerHTML = `
        <div class="desk-info-popup-content quick-book">
            <button class="popup-close" onclick="this.closest('.desk-info-popup').remove()">×</button>
            <div class="popup-header">
                <h3>Book ${desk.name}</h3>
            </div>
            <p class="popup-hint">Enter your name to book this desk. Your info will be saved for quick booking next time.</p>
            <form id="quickBookForm" class="quick-book-form">
                <input type="hidden" id="quickBookDeskId" value="${desk.id}">
                <div class="form-group">
                    <input type="text" id="quickBookName" required placeholder="Your name" autofocus>
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
        await fetch(`/api/desk-bookings/${bookingId}`, { method: 'DELETE' });
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
            await fetch(`/api/floor-elements/${el.id}`, { method: 'DELETE' });
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
                const response = await fetch(`/api/floor-elements/${dragState.elementId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
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
                await fetch(`/api/desks/${deskId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
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
        `<option value="${loc.id}" ${loc.id === state.currentLocation ? 'selected' : ''}>${loc.name}</option>`
    ).join('');
    
    // Populate team select (sorted alphabetically)
    const sortedTeams = [...state.teams].sort((a, b) => a.name.localeCompare(b.name));
    assignedTeamSelect.innerHTML = sortedTeams.map(t => 
        `<option value="${t.id}">${t.name}</option>`
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
        let response;
        if (editDeskId) {
            response = await fetch(`/api/desks/${editDeskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(deskData)
            });
        } else {
            response = await fetch('/api/desks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
        await fetch(`/api/desks/${deskId}`, { method: 'DELETE' });
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
        if (editRoomId) {
            await fetch(`/api/floor-elements/${editRoomId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(roomData)
            });
        } else {
            await fetch('/api/floor-elements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
        if (editWallId) {
            // Update existing wall
            await fetch(`/api/floor-elements/${editWallId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
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
                headers: { 'Content-Type': 'application/json' },
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
        if (editLabelId) {
            await fetch(`/api/floor-elements/${editLabelId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(labelData)
            });
        } else {
            await fetch('/api/floor-elements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
        // Load saved name from localStorage
        const savedName = localStorage.getItem('employeeName');
        const savedEmail = localStorage.getItem('employeeEmail');
        const savedTeamId = localStorage.getItem('employeeTeamId');
        if (savedName) document.getElementById('employeeName').value = savedName;
        if (savedEmail) document.getElementById('employeeEmail').value = savedEmail;
        
        // Populate team selector (sorted alphabetically)
        const teamSelect = document.getElementById('deskBookingTeam');
        const sortedTeams = [...state.teams].sort((a, b) => a.name.localeCompare(b.name));
        teamSelect.innerHTML = '<option value="">-- No team --</option>' + 
            sortedTeams.map(team => 
                `<option value="${team.id}" ${team.id === savedTeamId ? 'selected' : ''} style="color: ${team.color}">${team.name}</option>`
            ).join('');
    }
    
    infoDiv.innerHTML = `
        <h3>${desk.name}</h3>
        <p>${location?.name || ''} ${desk.floor ? `• Floor ${desk.floor}` : ''} ${desk.zone ? `• ${desk.zone}` : ''}</p>
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
        const response = await fetch('/api/desk-bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        await fetch(`/api/desk-bookings/${bookingId}`, { method: 'DELETE' });
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

// ============================================
// Initialize Application
// ============================================

document.addEventListener('DOMContentLoaded', init);


