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
    currentRoom: null,
    weatherCache: {}, // locationId -> { coords: {lat, lon}, forecast: [...], fetchedAt: Date }
    bookingsCache: {} // "locationId:year-month" -> { bookings: [], fetchedAt: Date }
};

// Cache settings
const BOOKINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

async function initApp() {
    loadTheme();
    await loadData();
    await loadBookingsForMonth(); // Load bookings for current month
    setupEventListeners();
    renderCalendar();
    updateCapacityDisplay();
    initSocket();
    
    // Fetch weather in background (don't block init)
    fetchWeatherForLocation(state.currentLocation).then(() => {
        renderCalendar(); // Re-render with weather
    });
}

// ============================================
// Weather Integration (Open-Meteo)
// ============================================

const WEATHER_ICONS = {
    0: '☀️',   // Clear sky
    1: '🌤️',  // Mainly clear
    2: '⛅',   // Partly cloudy
    3: '☁️',   // Overcast
    45: '🌫️', // Fog
    48: '🌫️', // Depositing rime fog
    51: '🌧️', // Light drizzle
    53: '🌧️', // Moderate drizzle
    55: '🌧️', // Dense drizzle
    56: '🌨️', // Light freezing drizzle
    57: '🌨️', // Dense freezing drizzle
    61: '🌧️', // Slight rain
    63: '🌧️', // Moderate rain
    65: '🌧️', // Heavy rain
    66: '🌨️', // Light freezing rain
    67: '🌨️', // Heavy freezing rain
    71: '❄️',  // Slight snow
    73: '❄️',  // Moderate snow
    75: '❄️',  // Heavy snow
    77: '❄️',  // Snow grains
    80: '🌦️', // Slight rain showers
    81: '🌦️', // Moderate rain showers
    82: '🌧️', // Violent rain showers
    85: '🌨️', // Slight snow showers
    86: '🌨️', // Heavy snow showers
    95: '⛈️', // Thunderstorm
    96: '⛈️', // Thunderstorm with slight hail
    99: '⛈️'  // Thunderstorm with heavy hail
};

async function geocodeAddress(address) {
    if (!address) return null;
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
            { headers: { 'User-Agent': 'OfficeBookingSystem/1.0' } }
        );
        const data = await response.json();
        if (data && data.length > 0) {
            return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        }
    } catch (error) {
        console.error('Geocoding error:', error);
    }
    return null;
}

async function fetchWeatherForLocation(locationId) {
    const location = state.locations.find(l => l.id === locationId);
    if (!location || !location.address) return null;
    
    // Check cache (valid for 1 hour)
    const cached = state.weatherCache[locationId];
    if (cached && cached.fetchedAt && (Date.now() - cached.fetchedAt) < 3600000) {
        return cached.forecast;
    }
    
    // Get coordinates
    let coords = cached?.coords;
    if (!coords) {
        coords = await geocodeAddress(location.address);
        if (!coords) return null;
    }
    
    try {
        // Fetch 14-day forecast from Open-Meteo
        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=14`
        );
        const data = await response.json();
        
        if (data && data.daily) {
            const forecast = data.daily.time.map((date, i) => ({
                date,
                weatherCode: data.daily.weather_code[i],
                tempMax: Math.round(data.daily.temperature_2m_max[i]),
                tempMin: Math.round(data.daily.temperature_2m_min[i])
            }));
            
            // Cache the result
            state.weatherCache[locationId] = {
                coords,
                forecast,
                fetchedAt: Date.now()
            };
            
            return forecast;
        }
    } catch (error) {
        console.error('Weather fetch error:', error);
    }
    return null;
}

function getWeatherIcon(weatherCode) {
    return WEATHER_ICONS[weatherCode] || '🌡️';
}

const WEATHER_DESCRIPTIONS = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail'
};

function getWeatherDescription(weatherCode) {
    return WEATHER_DESCRIPTIONS[weatherCode] || 'Unknown';
}

function showWeatherTooltip(event, element) {
    const code = parseInt(element.dataset.weatherCode);
    const tempMax = element.dataset.tempMax;
    const tempMin = element.dataset.tempMin;
    const desc = getWeatherDescription(code);
    const icon = getWeatherIcon(code);
    
    let tooltip = document.getElementById('weatherTooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'weatherTooltip';
        tooltip.className = 'weather-tooltip';
        document.body.appendChild(tooltip);
    }
    
    tooltip.innerHTML = `
        <div class="weather-tooltip-icon">${icon}</div>
        <div class="weather-tooltip-info">
            <div class="weather-tooltip-desc">${desc}</div>
            <div class="weather-tooltip-temps">
                <span class="temp-high">↑ ${tempMax}°C</span>
                <span class="temp-low">↓ ${tempMin}°C</span>
            </div>
        </div>
    `;
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 8}px`;
    tooltip.classList.add('visible');
}

function hideWeatherTooltip() {
    const tooltip = document.getElementById('weatherTooltip');
    if (tooltip) {
        tooltip.classList.remove('visible');
    }
}

function getWeatherForDate(dateStr) {
    const cached = state.weatherCache[state.currentLocation];
    if (!cached || !cached.forecast) return null;
    
    const weather = cached.forecast.find(w => w.date === dateStr);
    return weather;
}

// ============================================
// Real-Time Socket.IO
// ============================================

function initSocket() {
    // Use authenticated user's name
    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (currentUser) {
        state.myName = currentUser.name;
        state.myUserId = currentUser.id;
    } else {
        // Fallback for non-authenticated mode
        state.myName = localStorage.getItem('userName');
        if (!state.myName) {
            state.myName = prompt('Enter your name for live presence:') || 'Anonymous';
            localStorage.setItem('userName', state.myName);
        }
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
        
        // Helper to check if a booking belongs to the current month/location view
        const isInCurrentView = (b) => {
            if (!b || b.locationId !== state.currentLocation) return false;
            const bookingDate = new Date(b.date);
            return bookingDate.getFullYear() === state.currentDate.getFullYear() &&
                   bookingDate.getMonth() === state.currentDate.getMonth();
        };
        
        if (type === 'booking:created' && booking) {
            // Add to local state if in same location and month
            if (isInCurrentView(booking)) {
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
                // Check if booking moved out of current view
                if (isInCurrentView(booking)) {
                    state.bookings[index] = booking;
                } else {
                    // Moved to different month/location, remove from local state
                    state.bookings.splice(index, 1);
                }
                renderCalendar();
                updateCapacityDisplay();
                showToast(`${booking.teamName} updated`, 'success');
            } else if (isInCurrentView(booking)) {
                // Booking moved into this month/location
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
        // Bookings are now loaded per-month via loadBookingsForMonth()
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

// Load bookings for the current month and location only (with caching)
async function loadBookingsForMonth(forceRefresh = false) {
    try {
        const year = state.currentDate.getFullYear();
        const month = state.currentDate.getMonth(); // 0-indexed
        const location = state.currentLocation;
        const cacheKey = `${location}:${year}-${month}`;
        
        // Check cache first (unless force refresh)
        const cached = state.bookingsCache[cacheKey];
        if (!forceRefresh && cached && (Date.now() - cached.fetchedAt) < BOOKINGS_CACHE_TTL) {
            state.bookings = cached.bookings;
            return;
        }
        
        const response = await fetch(`/api/bookings?year=${year}&month=${month}&location=${location}`);
        if (!response.ok) {
            throw new Error('Failed to fetch bookings');
        }
        
        const bookings = await response.json();
        
        // Update cache
        state.bookingsCache[cacheKey] = {
            bookings,
            fetchedAt: Date.now()
        };
        
        state.bookings = bookings;
    } catch (error) {
        console.error('Failed to load bookings:', error);
        showToast('Failed to load bookings', 'error');
    }
}

// Invalidate cache for a specific month or all
function invalidateBookingsCache(year, month, location) {
    if (year !== undefined && month !== undefined && location) {
        const cacheKey = `${location}:${year}-${month}`;
        delete state.bookingsCache[cacheKey];
    } else {
        state.bookingsCache = {};
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
    
    // Keyboard shortcuts for month navigation
    document.addEventListener('keydown', (e) => {
        // Don't trigger if user is typing in an input/textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }
        
        // Only when calendar view is active
        if (!document.getElementById('calendarView').classList.contains('active')) {
            return;
        }
        
        switch(e.key) {
            case 'ArrowLeft':
                navigateMonth(-1);
                e.preventDefault();
                break;
            case 'ArrowRight':
                navigateMonth(1);
                e.preventDefault();
                break;
            case 't':
            case 'T':
                goToToday();
                e.preventDefault();
                break;
        }
    });
    
    // Location change
    elements.locationSelect.addEventListener('change', async (e) => {
        state.currentLocation = e.target.value;
        state.bookings = []; // Clear bookings to show loading state
        renderCalendar(true); // Show loading state immediately
        updateCapacityDisplay();
        renderTeamSelect();
        joinCurrentRoom();
        
        // Fetch weather for new location
        fetchWeatherForLocation(state.currentLocation).then(() => {
            renderCalendar();
        });
        
        // Load bookings in background and re-render when done
        await loadBookingsForMonth();
        renderCalendar();
        updateCapacityDisplay();
        
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

function renderCalendar(isLoading = false) {
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
    
    // Track loading state for calendar grid styling
    const calendarGrid = elements.calendarGrid;
    if (isLoading) {
        calendarGrid.classList.add('loading');
    } else {
        calendarGrid.classList.remove('loading');
    }
    
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
        
        // Weather icon (only for today and future dates within forecast range)
        const weather = getWeatherForDate(dateStr);
        const todayStr = formatDateStr(today);
        if (weather && dateStr >= todayStr) {
            const weatherDesc = getWeatherDescription(weather.weatherCode);
            dayContent += `<span class="day-weather" 
                data-weather-code="${weather.weatherCode}"
                data-temp-max="${weather.tempMax}"
                data-temp-min="${weather.tempMin}"
                onmouseenter="showWeatherTooltip(event, this)"
                onmouseleave="hideWeatherTooltip()">${getWeatherIcon(weather.weatherCode)}</span>`;
        }
        
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
    
    // Also render mobile list view
    renderCalendarList(year, month, monthBookings, capacity, today, isLoading);
}

function renderCalendarList(year, month, monthBookings, capacity, today, isLoading = false) {
    const listContainer = document.getElementById('calendarList');
    if (!listContainer) return;
    
    // Track loading state
    if (isLoading) {
        listContainer.classList.add('loading');
    } else {
        listContainer.classList.remove('loading');
    }
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const totalDays = new Date(year, month + 1, 0).getDate();
    const todayStr = formatDateStr(today);
    
    let listHtml = '';
    
    for (let day = 1; day <= totalDays; day++) {
        const date = new Date(year, month, day);
        const dateStr = formatDateStr(date);
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isToday = date.toDateString() === today.toDateString();
        const holiday = state.publicHolidays.find(h => h.date === dateStr);
        
        // Skip weekends in list view
        if (isWeekend) continue;
        
        const dayBookings = monthBookings.filter(b => b.date === dateStr);
        const totalPeople = dayBookings.reduce((sum, b) => sum + getBookingPeopleCount(b), 0);
        
        let classes = ['calendar-list-day'];
        if (isToday) classes.push('today');
        if (holiday) classes.push('holiday');
        
        // Capacity class
        let capacityClass = '';
        if (totalPeople >= capacity) capacityClass = 'full';
        else if (totalPeople >= capacity * 0.8) capacityClass = 'warning';
        
        // Weather
        const weather = getWeatherForDate(dateStr);
        const weatherHtml = (weather && dateStr >= todayStr) 
            ? `<span class="calendar-list-weather">${getWeatherIcon(weather.weatherCode)}</span>` 
            : '';
        
        // Bookings HTML
        let bookingsHtml = '';
        if (isLoading && !holiday) {
            // Show loading skeleton
            bookingsHtml = `<div class="calendar-list-loading-skeleton"></div>`;
        } else if (holiday) {
            bookingsHtml = `<div class="calendar-list-holiday">${holiday.name}</div>`;
        } else if (dayBookings.length > 0) {
            const sortedBookings = [...dayBookings].sort((a, b) => {
                const teamA = state.teams.find(t => t.id === a.teamId);
                const teamB = state.teams.find(t => t.id === b.teamId);
                return (teamA?.name || '').localeCompare(teamB?.name || '');
            });
            
            bookingsHtml = '<div class="calendar-list-bookings">';
            sortedBookings.forEach(booking => {
                const team = state.teams.find(t => t.id === booking.teamId);
                const color = team ? team.color : '#6B7280';
                const displayName = team ? team.name : booking.teamName;
                const displayCount = team ? team.memberCount : booking.peopleCount;
                const managerImage = team?.managerImage;
                const managerName = team?.manager || '';
                
                // Avatar HTML
                let avatarHtml = '';
                if (managerImage) {
                    avatarHtml = `<img src="${managerImage}" alt="${managerName}" class="calendar-list-booking-avatar">`;
                } else {
                    const initials = getInitials(managerName);
                    avatarHtml = `<div class="calendar-list-booking-avatar" style="background: ${color}">${initials}</div>`;
                }
                
                bookingsHtml += `
                    <div class="calendar-list-booking" onclick="openBookingModal('${dateStr}')">
                        ${avatarHtml}
                        <div class="calendar-list-booking-color" style="background: ${color}"></div>
                        <div class="calendar-list-booking-info">
                            <span class="calendar-list-booking-team">${displayName}</span>
                            <span class="calendar-list-booking-count">${displayCount} people</span>
                        </div>
                    </div>
                `;
            });
            bookingsHtml += '</div>';
        } else {
            bookingsHtml = `<div class="calendar-list-empty" onclick="openBookingModal('${dateStr}')">No bookings - tap to add</div>`;
        }
        
        listHtml += `
            <div class="${classes.join(' ')}">
                <div class="calendar-list-header" onclick="openBookingModal('${dateStr}')">
                    <div class="calendar-list-date">
                        <span class="calendar-list-day-num">${day}</span>
                        <span class="calendar-list-day-name">${dayNames[dayOfWeek]}</span>
                    </div>
                    <div class="calendar-list-meta">
                        ${weatherHtml}
                        ${!holiday ? `<span class="calendar-list-capacity ${capacityClass}">${totalPeople}/${capacity}</span>` : ''}
                    </div>
                </div>
                ${bookingsHtml}
            </div>
        `;
    }
    
    listContainer.innerHTML = listHtml;
}

// Navigation state to prevent rapid clicking
let isNavigating = false;

async function navigateMonth(delta) {
    // Prevent rapid navigation while loading
    if (isNavigating) return;
    isNavigating = true;
    
    const grid = elements.calendarGrid;
    const animClass = delta > 0 ? 'slide-left' : 'slide-right';
    
    // Remove any existing animation class
    grid.classList.remove('slide-left', 'slide-right');
    
    // Update date and render calendar immediately with loading state
    state.currentDate.setMonth(state.currentDate.getMonth() + delta);
    state.bookings = []; // Clear bookings to show loading state
    renderCalendar(true); // Pass loading flag
    joinCurrentRoom();
    
    // Trigger animation
    void grid.offsetWidth; // Force reflow
    grid.classList.add(animClass);
    
    // Clean up after animation
    setTimeout(() => grid.classList.remove(animClass), 200);
    
    // Load bookings in background and re-render when done
    await loadBookingsForMonth();
    renderCalendar();
    
    isNavigating = false;
}

async function goToToday() {
    state.currentDate = new Date();
    state.bookings = []; // Clear bookings to show loading state
    renderCalendar(true); // Show loading state
    updateCapacityDisplay();
    joinCurrentRoom();
    
    // Load bookings in background and re-render when done
    await loadBookingsForMonth();
    renderCalendar();
    updateCapacityDisplay();
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
        
        // Check capacity and handle overbooking
        checkOverbooking();
        
        document.getElementById('teamMemberCount').innerHTML = infoHtml;
    }
}

function checkOverbooking() {
    const teamId = document.getElementById('teamSelect').value;
    const team = state.teams.find(t => t.id === teamId);
    const bookingId = document.getElementById('bookingId').value;
    
    if (!team || !state.selectedDate) {
        hideOverbookingWarning();
        return false;
    }
    
    const memberCount = team.memberCount || 0;
    const location = state.locations.find(l => l.id === state.currentLocation);
    const capacity = location ? location.capacity : 21;
    
    // Get current bookings for this day, excluding the booking being edited
    const dayBookings = state.bookings.filter(
        b => b.date === state.selectedDate && 
             b.locationId === state.currentLocation &&
             b.id !== bookingId
    );
    const used = dayBookings.reduce((sum, b) => sum + getBookingPeopleCount(b), 0);
    const newTotal = used + memberCount;
    
    if (newTotal > capacity) {
        showOverbookingWarning(newTotal, capacity, newTotal - capacity);
        return true;
    } else {
        hideOverbookingWarning();
        return false;
    }
}

function showOverbookingWarning(total, capacity, excess) {
    const warning = document.getElementById('overbookingWarning');
    const message = document.getElementById('overbookingMessage');
    const notesLabel = document.getElementById('notesRequiredLabel');
    const notesField = document.getElementById('bookingNotes');
    
    if (warning) {
        warning.style.display = 'flex';
        message.textContent = `This will bring the total to ${total} people (${excess} over the ${capacity} capacity). Please explain in the notes why this overbooking is needed.`;
    }
    if (notesLabel) {
        notesLabel.style.display = 'inline';
    }
    if (notesField) {
        notesField.required = true;
        notesField.placeholder = 'Required: Explain why overbooking is needed...';
    }
}

function hideOverbookingWarning() {
    const warning = document.getElementById('overbookingWarning');
    const notesLabel = document.getElementById('notesRequiredLabel');
    const notesField = document.getElementById('bookingNotes');
    
    if (warning) {
        warning.style.display = 'none';
    }
    if (notesLabel) {
        notesLabel.style.display = 'none';
    }
    if (notesField) {
        notesField.required = false;
        notesField.placeholder = 'Any additional notes...';
    }
}

function closeModal() {
    elements.bookingModal.classList.remove('active');
    state.selectedDate = null;
    hideOverbookingWarning();
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
        
        await loadBookingsForMonth(true); // Force refresh after modification
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
        
        await loadBookingsForMonth(true); // Force refresh after deletion
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
        await loadBookingsForMonth(); // Refresh bookings for calendar display
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
        await loadBookingsForMonth(); // Refresh bookings for calendar display
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
    if (!confirm('Are you sure you want to delete this team? All bookings for this team will also be deleted.')) return;
    
    try {
        await fetch(`/api/teams/${id}`, { method: 'DELETE' });
        showToast('Team deleted', 'success');
        
        // Clear bookings cache to force refresh
        state.bookingsCache = {};
        
        await loadData();
        await loadBookingsForMonth(true); // Force refresh bookings
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
        await loadBookingsForMonth(); // Refresh bookings for new location
        
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
    
    // Reset manager selector
    clearSelectedManager();
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

async function switchView(viewName) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewName);
    });
    
    // Update views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.toggle('active', view.id === `${viewName}View`);
    });
    
    // Initialize desks view when selected (with lazy loading)
    if (viewName === 'desks') {
        await loadFloorPlanModule();
        if (typeof initDesksView === 'function') {
            initDesksView();
        }
    }
    
    // Re-render locations when settings view becomes visible to initialize maps
    if (viewName === 'settings') {
        // Small delay to ensure the view is fully visible and has dimensions
        setTimeout(() => {
            renderLocationsList();
        }, 200);
    }
    
    // Initialize team roles view
    if (viewName === 'teamRoles') {
        initTeamRolesView();
    }
}

// Lazy load the floor plan module
let floorPlanModuleLoading = false;
async function loadFloorPlanModule() {
    // Already loaded
    if (window.floorPlanLoaded) return;
    
    // Already loading
    if (floorPlanModuleLoading) {
        // Wait for it to finish
        while (floorPlanModuleLoading && !window.floorPlanLoaded) {
            await new Promise(r => setTimeout(r, 50));
        }
        return;
    }
    
    floorPlanModuleLoading = true;
    
    // Show loading state in the floor map
    const floorMap = document.getElementById('floorMap');
    if (floorMap) {
        floorMap.innerHTML = `
            <div class="floor-plan-loading">
                <div class="loading-spinner"></div>
                <p>Loading floor plan...</p>
            </div>
        `;
    }
    
    try {
        // Dynamically load the floor plan script
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/floor-plan.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        
        console.log('Floor plan module loaded successfully');
    } catch (error) {
        console.error('Failed to load floor plan module:', error);
        showToast('Failed to load floor plan', 'error');
    }
    
    floorPlanModuleLoading = false;
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
        
        // Refresh bookings to confirm server state
        await loadBookingsForMonth(true); // Force refresh after move
        renderCalendar();
        
    } catch (error) {
        // Rollback on error
        await loadBookingsForMonth(true); // Force refresh to get correct state
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
// Desk Booking System (Lazy Loaded)
// ============================================
// Floor plan code is now in floor-plan.js and loaded on demand
// See loadFloorPlanModule() in switchView()

// Placeholder for updateFloorSelector - called from location change handler
function updateFloorSelector() {
    // Will be overwritten when floor-plan.js loads
    console.log('Floor plan module not yet loaded');
}

// Placeholder for loadDesks - called from location change handler  
function loadDesks() {
    // Will be overwritten when floor-plan.js loads
    console.log('Floor plan module not yet loaded');
}

// ============================================
// Team Roles (Azure AD Integration)
// ============================================

// Store allowed team lead roles
let allowedTeamRoles = JSON.parse(localStorage.getItem('allowedTeamRoles') || '[]');
let azureADJobTitles = [];
let azureADManagers = []; // Cached managers from Azure AD

async function initTeamRolesView() {
    const jobTitlesList = document.getElementById('jobTitlesList');
    const refreshBtn = document.getElementById('refreshRolesBtn');
    
    if (!jobTitlesList) return;
    
    // Show loading
    jobTitlesList.innerHTML = '<div class="loading-spinner">Loading job titles from Azure AD...</div>';
    
    // Fetch job titles from Azure AD
    if (typeof fetchAllJobTitles === 'function') {
        try {
            azureADJobTitles = await fetchAllJobTitles();
            renderJobTitlesList();
            renderAllowedRolesList();
        } catch (error) {
            console.error('Failed to fetch job titles:', error);
            jobTitlesList.innerHTML = '<p class="empty-state">Failed to load job titles. Please try again.</p>';
        }
    } else {
        jobTitlesList.innerHTML = '<p class="empty-state">Azure AD authentication required.</p>';
    }
    
    // Refresh button
    if (refreshBtn) {
        refreshBtn.onclick = async () => {
            await initTeamRolesView();
            showToast('Job titles refreshed from Azure AD', 'success');
        };
    }
}

function renderJobTitlesList() {
    const container = document.getElementById('jobTitlesList');
    if (!container) return;
    
    if (azureADJobTitles.length === 0) {
        container.innerHTML = '<p class="empty-state">No job titles found in Azure AD.</p>';
        return;
    }
    
    container.innerHTML = azureADJobTitles.map(title => {
        const isSelected = allowedTeamRoles.includes(title);
        return `
            <button class="job-title-chip ${isSelected ? 'selected' : ''}" 
                    onclick="toggleTeamRole('${escapeHtml(title)}')"
                    title="${isSelected ? 'Click to remove' : 'Click to add as allowed role'}">
                ${isSelected ? `
                    <svg class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                ` : ''}
                ${escapeHtml(title)}
            </button>
        `;
    }).join('');
}

function renderAllowedRolesList() {
    const container = document.getElementById('allowedRolesList');
    if (!container) return;
    
    if (allowedTeamRoles.length === 0) {
        container.innerHTML = '<p class="empty-state">No roles selected yet. Click on job titles above to allow them.</p>';
        return;
    }
    
    container.innerHTML = allowedTeamRoles.map(role => `
        <span class="allowed-role-chip">
            ${escapeHtml(role)}
            <button class="remove-role" onclick="toggleTeamRole('${escapeHtml(role)}')" title="Remove">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </span>
    `).join('');
}

function toggleTeamRole(title) {
    const index = allowedTeamRoles.indexOf(title);
    if (index >= 0) {
        allowedTeamRoles.splice(index, 1);
    } else {
        allowedTeamRoles.push(title);
    }
    
    // Sort alphabetically
    allowedTeamRoles.sort((a, b) => a.localeCompare(b));
    
    // Save to localStorage
    localStorage.setItem('allowedTeamRoles', JSON.stringify(allowedTeamRoles));
    
    // Re-render both lists
    renderJobTitlesList();
    renderAllowedRolesList();
    
    // Clear cached managers so they're refetched with new roles
    azureADManagers = [];
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Fetch managers from Azure AD based on allowed roles
async function fetchAzureADManagers() {
    if (azureADManagers.length > 0) {
        return azureADManagers; // Return cached
    }
    
    if (allowedTeamRoles.length === 0) {
        return [];
    }
    
    if (typeof fetchUsersByJobTitles === 'function') {
        try {
            azureADManagers = await fetchUsersByJobTitles(allowedTeamRoles);
            return azureADManagers;
        } catch (error) {
            console.error('Failed to fetch managers:', error);
            return [];
        }
    }
    return [];
}

// Get direct reports count for a manager
async function getManagerDirectReportsCount(managerId) {
    if (typeof fetchDirectReports === 'function') {
        try {
            const reports = await fetchDirectReports(managerId);
            return reports.length;
        } catch (error) {
            console.error('Failed to fetch direct reports:', error);
            return 0;
        }
    }
    return 0;
}

// Manager selector for team form
let managerDropdownOpen = false;

async function openManagerSelector() {
    const dropdown = document.getElementById('managerDropdown');
    const btn = document.getElementById('selectManagerBtn');
    
    if (!dropdown) return;
    
    if (managerDropdownOpen) {
        closeManagerDropdown();
        return;
    }
    
    // Show loading state
    btn.disabled = true;
    btn.innerHTML = `
        <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;animation:spin 1s linear infinite">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"></path>
        </svg>
        Loading managers...
    `;
    
    // Fetch managers from Azure AD
    const managers = await fetchAzureADManagers();
    
    btn.disabled = false;
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
        </svg>
        Select from Azure AD
    `;
    
    if (managers.length === 0) {
        if (allowedTeamRoles.length === 0) {
            dropdown.innerHTML = `
                <div style="padding: 1rem; text-align: center; color: var(--text-muted);">
                    <p>No team lead roles configured.</p>
                    <p style="font-size: 0.85rem; margin-top: 0.5rem;">Go to Settings → Team Roles to select which job titles can lead teams.</p>
                </div>
            `;
        } else {
            dropdown.innerHTML = `
                <div style="padding: 1rem; text-align: center; color: var(--text-muted);">
                    No managers found with the allowed job titles.
                </div>
            `;
        }
    } else {
        dropdown.innerHTML = managers.sort((a, b) => a.displayName.localeCompare(b.displayName)).map(manager => `
            <div class="manager-option" onclick="selectManager('${manager.id}', '${escapeHtml(manager.displayName)}', '${escapeHtml(manager.jobTitle || '')}', '${escapeHtml(manager.mail || manager.userPrincipalName || '')}')">
                <div class="manager-option-avatar">
                    <span>${getInitials(manager.displayName)}</span>
                </div>
                <div class="manager-option-info">
                    <div class="manager-option-name">${escapeHtml(manager.displayName)}</div>
                    <div class="manager-option-title">${escapeHtml(manager.jobTitle || 'No title')}</div>
                </div>
            </div>
        `).join('');
    }
    
    dropdown.classList.add('open');
    managerDropdownOpen = true;
    
    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', closeManagerDropdownOnClickOutside);
    }, 0);
}

function closeManagerDropdown() {
    const dropdown = document.getElementById('managerDropdown');
    if (dropdown) {
        dropdown.classList.remove('open');
    }
    managerDropdownOpen = false;
    document.removeEventListener('click', closeManagerDropdownOnClickOutside);
}

function closeManagerDropdownOnClickOutside(e) {
    const dropdown = document.getElementById('managerDropdown');
    const btn = document.getElementById('selectManagerBtn');
    if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
        closeManagerDropdown();
    }
}

async function selectManager(id, name, title, email) {
    closeManagerDropdown();
    
    // Update hidden field
    document.getElementById('teamManagerId').value = id;
    
    // Update display
    const display = document.getElementById('selectedManagerDisplay');
    const avatar = document.getElementById('selectedManagerAvatar');
    const nameEl = document.getElementById('selectedManagerName');
    const metaEl = document.getElementById('selectedManagerMeta');
    const managerInput = document.getElementById('teamManager');
    const selectBtn = document.getElementById('selectManagerBtn');
    
    nameEl.textContent = name;
    avatar.innerHTML = `<span>${getInitials(name)}</span>`;
    
    // Show loading state for direct reports
    metaEl.textContent = 'Loading team size...';
    display.style.display = 'flex';
    selectBtn.style.display = 'none';
    managerInput.style.display = 'none';
    managerInput.value = name;
    
    // Fetch photo
    if (typeof fetchUserPhotoById === 'function') {
        const photo = await fetchUserPhotoById(id);
        if (photo) {
            avatar.innerHTML = `<img src="${photo}" alt="${name}">`;
            document.getElementById('teamManagerImage').value = photo;
        }
    }
    
    // Fetch direct reports count
    const directReportsCount = await getManagerDirectReportsCount(id);
    metaEl.textContent = `${title} • ${directReportsCount} direct reports`;
    
    // Auto-fill member count
    const memberCountInput = document.getElementById('teamMemberCountInput');
    const memberCountHint = document.getElementById('memberCountHint');
    
    if (directReportsCount > 0) {
        memberCountInput.value = directReportsCount;
        memberCountHint.textContent = `Auto-filled from Azure AD (${directReportsCount} direct reports)`;
        memberCountHint.style.display = 'block';
    }
}

function clearSelectedManager() {
    document.getElementById('teamManagerId').value = '';
    document.getElementById('selectedManagerDisplay').style.display = 'none';
    document.getElementById('selectManagerBtn').style.display = 'flex';
    document.getElementById('teamManager').style.display = 'block';
    document.getElementById('teamManager').value = '';
    document.getElementById('teamManagerImage').value = '';
    document.getElementById('memberCountHint').style.display = 'none';
}

// ============================================
// Initialize Application
// ============================================

// App initialization is triggered by auth.js after successful login
// See initApp() function
