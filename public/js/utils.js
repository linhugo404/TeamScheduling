/**
 * Utility Functions
 * Common helper functions used across the application
 */

import { UI_CONFIG } from './config.js';

/**
 * Format a Date object to YYYY-MM-DD string
 */
export function formatDateStr(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Format date for display (e.g., "Monday, January 15, 2024")
 */
export function formatDisplayDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Show a toast notification
 */
export function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // Accessibility: announce to screen readers
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after configured duration
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), UI_CONFIG.animationDuration);
    }, UI_CONFIG.toastDuration);
}

/**
 * Get initials from a name
 */
export function getInitials(name) {
    if (!name) return '?';
    return name.split(' ')
        .filter(n => n.length > 0)
        .map(n => n[0].toUpperCase())
        .slice(0, 2)
        .join('');
}

/**
 * Generate avatar HTML (image or initials)
 */
export function getAvatarHTML(managerName, imageUrl, color, className = '') {
    const safeName = escapeHtml(managerName || '');
    const safeColor = escapeHtml(color || '#6B7280');
    if (imageUrl) {
        return `<img src="${imageUrl}" alt="${safeName}" class="${className}" loading="lazy">`;
    }
    const initials = getInitials(managerName);
    return `<div class="${className}" style="background: ${safeColor}; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">${initials}</div>`;
}

/**
 * Adjust color brightness
 */
export function adjustColor(color, amount) {
    const clamp = (num) => Math.min(255, Math.max(0, num));
    const hex = color.replace('#', '');
    const r = clamp(parseInt(hex.substr(0, 2), 16) + amount);
    const g = clamp(parseInt(hex.substr(2, 2), 16) + amount);
    const b = clamp(parseInt(hex.substr(4, 2), 16) + amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Generate a consistent color from a string
 */
export function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Get effective people count for a booking
 * Uses current team memberCount if available
 */
export function getBookingPeopleCount(booking, teams) {
    const team = teams.find(t => t.id === booking.teamId);
    return team ? team.memberCount : booking.peopleCount;
}

