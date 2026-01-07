/**
 * View Switching
 * Handles navigation between different views (calendar, teams, settings, etc.)
 */

import { renderTeamsList, renderTeamLocationSelect } from './teams.js';
import { renderLocationsList } from './locations.js';
import { renderHolidaysList, renderHolidayYearSelect } from './holidays.js';

// Floor plan module loading state
let floorPlanModuleLoading = false;
let floorPlanModuleLoaded = false;

/**
 * Switch to a different view
 */
export async function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    
    // Show selected view
    const targetView = document.getElementById(`${viewName}View`);
    if (targetView) {
        targetView.classList.add('active');
    }
    
    // Update nav active state
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewName);
    });
    
    // Close mobile menu
    closeMobileMenu();
    
    // View-specific initialization
    switch (viewName) {
        case 'calendar':
            window.renderCalendar?.();
            break;
            
        case 'teams':
            renderTeamsList();
            renderTeamLocationSelect();
            break;
            
        case 'locations':
            renderLocationsList();
            break;
            
        case 'holidays':
            renderHolidayYearSelect();
            renderHolidaysList();
            break;
            
        case 'desks':
            await loadFloorPlanModule();
            break;
            
        case 'teamRoles':
            window.initTeamRolesView?.();
            break;
    }
}

/**
 * Load floor plan module lazily
 */
async function loadFloorPlanModule() {
    if (floorPlanModuleLoaded || floorPlanModuleLoading) {
        // Module already loaded, just initialize
        if (typeof window.initDesksView === 'function') {
            window.initDesksView();
        }
        return;
    }
    
    floorPlanModuleLoading = true;
    
    try {
        // Dynamically load the floor plan script
        await new Promise((resolve, reject) => {
            const existing = document.querySelector('script[src="floor-plan.js"]');
            if (existing) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'floor-plan.js';
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
        
        floorPlanModuleLoaded = true;
        
        // Initialize after load
        if (typeof window.initDesksView === 'function') {
            window.initDesksView();
        }
        
    } catch (error) {
        console.error('Failed to load floor plan module:', error);
    } finally {
        floorPlanModuleLoading = false;
    }
}

/**
 * Setup settings submenu toggle
 */
export function setupSettingsSubmenu() {
    const settingsToggle = document.getElementById('settingsToggle');
    const settingsSubmenu = document.getElementById('settingsSubmenu');
    
    if (!settingsToggle || !settingsSubmenu) {
        console.warn('Settings submenu elements not found, retrying...');
        setTimeout(setupSettingsSubmenu, 100);
        return;
    }
    
    // Remove any existing listeners by cloning
    const newToggle = settingsToggle.cloneNode(true);
    settingsToggle.parentNode.replaceChild(newToggle, settingsToggle);
    
    newToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        newToggle.classList.toggle('expanded');
        settingsSubmenu.classList.toggle('open');
    });
}

/**
 * Close mobile menu
 */
export function closeMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
}

/**
 * Toggle mobile menu
 */
export function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
}

