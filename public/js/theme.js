/**
 * Theme Management
 * Handles dark/light theme toggle and persistence
 * Supports auto-detection of system preference
 */

/**
 * Detect system color scheme preference
 */
function getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
    }
    return 'dark';
}

/**
 * Load theme from localStorage or detect from system
 */
export function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    
    // If no saved preference, use system preference
    const theme = savedTheme || getSystemTheme();
    document.documentElement.setAttribute('data-theme', theme);
    
    // Listen for system theme changes (only if no manual preference set)
    if (!savedTheme && window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            // Only auto-switch if user hasn't set a manual preference
            if (!localStorage.getItem('theme')) {
                document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
            }
        });
    }
}

/**
 * Toggle between dark and light themes
 */
export function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

/**
 * Reset to system preference (clear manual override)
 */
export function resetToSystemTheme() {
    localStorage.removeItem('theme');
    document.documentElement.setAttribute('data-theme', getSystemTheme());
}

/**
 * Get current theme
 */
export function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
}

