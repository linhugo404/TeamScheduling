/**
 * Loading State Utilities
 * Manages loading states for buttons and async operations
 */

/**
 * Set a button to loading state
 * @param {HTMLButtonElement} button - The button element
 * @param {string} loadingText - Text to show while loading (default: 'Loading...')
 * @returns {Function} - Function to restore original state
 */
export function setButtonLoading(button, loadingText = 'Loading...') {
    if (!button) return () => {};
    
    const originalText = button.textContent;
    const originalDisabled = button.disabled;
    
    button.disabled = true;
    button.classList.add('loading');
    button.dataset.originalText = originalText;
    button.innerHTML = `
        <span class="btn-spinner"></span>
        <span>${loadingText}</span>
    `;
    
    // Return restore function
    return () => {
        button.disabled = originalDisabled;
        button.classList.remove('loading');
        button.textContent = originalText;
    };
}

/**
 * Wrap an async function with loading state management
 * @param {HTMLButtonElement} button - The button element
 * @param {Function} asyncFn - Async function to execute
 * @param {Object} options - Options
 * @param {string} options.loadingText - Text to show while loading
 * @param {string} options.successText - Text to show briefly on success
 * @returns {Promise<any>} - Result of the async function
 */
export async function withLoadingState(button, asyncFn, options = {}) {
    const { loadingText = 'Saving...', successText } = options;
    const restore = setButtonLoading(button, loadingText);
    
    try {
        const result = await asyncFn();
        
        // Brief success state
        if (successText && button) {
            button.classList.remove('loading');
            button.classList.add('success');
            button.innerHTML = `
                <span class="btn-check">✓</span>
                <span>${successText}</span>
            `;
            
            await new Promise(r => setTimeout(r, 1000));
        }
        
        return result;
    } finally {
        restore();
    }
}

/**
 * Show loading overlay on a container
 * @param {HTMLElement} container - Container element
 * @param {string} message - Loading message
 * @returns {Function} - Function to remove overlay
 */
export function showLoadingOverlay(container, message = 'Loading...') {
    if (!container) return () => {};
    
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
        <div class="loading-overlay-content">
            <div class="loading-spinner"></div>
            <p>${message}</p>
        </div>
    `;
    
    container.style.position = 'relative';
    container.appendChild(overlay);
    
    return () => {
        overlay.remove();
    };
}

/**
 * Disable form during submission
 * @param {HTMLFormElement} form - Form element
 * @returns {Function} - Function to re-enable form
 */
export function disableForm(form) {
    if (!form) return () => {};
    
    const elements = form.querySelectorAll('input, select, textarea, button');
    const originalStates = [];
    
    elements.forEach((el, i) => {
        originalStates[i] = el.disabled;
        el.disabled = true;
    });
    
    return () => {
        elements.forEach((el, i) => {
            el.disabled = originalStates[i];
        });
    };
}

