/**
 * Event Listener Manager
 * Tracks event listeners to prevent memory leaks and enable cleanup
 */

/**
 * Store for tracked event listeners
 * Map of element -> Map of event type -> Set of listener info
 */
const listenerStore = new WeakMap();

/**
 * Store listeners by namespace for bulk removal
 * Map of namespace -> Array of { element, type, listener, options }
 */
const namespaceStore = new Map();

/**
 * Add an event listener with tracking
 * @param {EventTarget} element - DOM element or EventTarget
 * @param {string} type - Event type (e.g., 'click', 'keydown')
 * @param {Function} listener - Event handler function
 * @param {Object} options - Options object
 * @param {string} options.namespace - Optional namespace for bulk removal
 * @param {boolean} options.capture - Use capture phase
 * @param {boolean} options.once - Remove after first invocation
 * @param {boolean} options.passive - Passive listener
 */
export function addTrackedListener(element, type, listener, options = {}) {
    if (!element || !type || !listener) return;
    
    const { namespace, ...eventOptions } = options;
    
    // Add the actual listener
    element.addEventListener(type, listener, eventOptions);
    
    // Track in element store
    if (!listenerStore.has(element)) {
        listenerStore.set(element, new Map());
    }
    const elementListeners = listenerStore.get(element);
    
    if (!elementListeners.has(type)) {
        elementListeners.set(type, new Set());
    }
    elementListeners.get(type).add({ listener, options: eventOptions });
    
    // Track in namespace store if provided
    if (namespace) {
        if (!namespaceStore.has(namespace)) {
            namespaceStore.set(namespace, []);
        }
        namespaceStore.get(namespace).push({ element, type, listener, options: eventOptions });
    }
}

/**
 * Remove a specific tracked listener
 * @param {EventTarget} element - DOM element
 * @param {string} type - Event type
 * @param {Function} listener - The listener to remove
 * @param {Object} options - Same options used when adding
 */
export function removeTrackedListener(element, type, listener, options = {}) {
    if (!element || !type || !listener) return;
    
    const { namespace, ...eventOptions } = options;
    
    // Remove the actual listener
    element.removeEventListener(type, listener, eventOptions);
    
    // Remove from tracking
    if (listenerStore.has(element)) {
        const elementListeners = listenerStore.get(element);
        if (elementListeners.has(type)) {
            const listeners = elementListeners.get(type);
            for (const info of listeners) {
                if (info.listener === listener) {
                    listeners.delete(info);
                    break;
                }
            }
            if (listeners.size === 0) {
                elementListeners.delete(type);
            }
        }
        if (elementListeners.size === 0) {
            listenerStore.delete(element);
        }
    }
}

/**
 * Remove all tracked listeners from an element
 * @param {EventTarget} element - DOM element
 */
export function removeAllListeners(element) {
    if (!element || !listenerStore.has(element)) return;
    
    const elementListeners = listenerStore.get(element);
    
    for (const [type, listeners] of elementListeners) {
        for (const { listener, options } of listeners) {
            element.removeEventListener(type, listener, options);
        }
    }
    
    listenerStore.delete(element);
}

/**
 * Remove all listeners in a namespace
 * Useful for cleaning up view-specific listeners
 * @param {string} namespace - The namespace to clean up
 */
export function removeNamespaceListeners(namespace) {
    if (!namespace || !namespaceStore.has(namespace)) return;
    
    const listeners = namespaceStore.get(namespace);
    
    for (const { element, type, listener, options } of listeners) {
        element.removeEventListener(type, listener, options);
        
        // Also remove from element store
        if (listenerStore.has(element)) {
            const elementListeners = listenerStore.get(element);
            if (elementListeners.has(type)) {
                const typeListeners = elementListeners.get(type);
                for (const info of typeListeners) {
                    if (info.listener === listener) {
                        typeListeners.delete(info);
                        break;
                    }
                }
            }
        }
    }
    
    namespaceStore.delete(namespace);
}

/**
 * Get count of tracked listeners (for debugging)
 * @returns {Object} - { total, byNamespace }
 */
export function getListenerStats() {
    let total = 0;
    const byNamespace = {};
    
    for (const [namespace, listeners] of namespaceStore) {
        byNamespace[namespace] = listeners.length;
        total += listeners.length;
    }
    
    return { total, byNamespace };
}

/**
 * Create a one-time listener that auto-removes
 * @param {EventTarget} element - DOM element
 * @param {string} type - Event type
 * @param {Function} listener - Event handler
 * @param {Object} options - Options
 */
export function addOnceListener(element, type, listener, options = {}) {
    const wrappedListener = (event) => {
        removeTrackedListener(element, type, wrappedListener, options);
        listener(event);
    };
    addTrackedListener(element, type, wrappedListener, options);
}

/**
 * Cleanup helper for views
 * Call this when switching away from a view
 * @param {string} viewName - Name of the view to clean up
 */
export function cleanupView(viewName) {
    removeNamespaceListeners(`view:${viewName}`);
}

// Export namespace constants for consistency
export const ViewNamespaces = {
    CALENDAR: 'view:calendar',
    TEAMS: 'view:teams',
    LOCATIONS: 'view:locations',
    DESKS: 'view:desks',
    HOLIDAYS: 'view:holidays',
    TEAM_ROLES: 'view:teamRoles',
};

