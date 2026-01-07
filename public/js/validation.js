/**
 * Input Validation Utilities
 * Frontend validation for forms before API submission
 */

/**
 * Validation result object
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string[]} errors - Array of error messages
 */

/**
 * Validate a required field
 * @param {string} value - Value to validate
 * @param {string} fieldName - Name of the field for error message
 * @returns {string|null} - Error message or null if valid
 */
export function validateRequired(value, fieldName) {
    if (!value || (typeof value === 'string' && !value.trim())) {
        return `${fieldName} is required`;
    }
    return null;
}

/**
 * Validate minimum length
 * @param {string} value - Value to validate
 * @param {number} min - Minimum length
 * @param {string} fieldName - Name of the field for error message
 * @returns {string|null} - Error message or null if valid
 */
export function validateMinLength(value, min, fieldName) {
    if (value && value.length < min) {
        return `${fieldName} must be at least ${min} characters`;
    }
    return null;
}

/**
 * Validate maximum length
 * @param {string} value - Value to validate
 * @param {number} max - Maximum length
 * @param {string} fieldName - Name of the field for error message
 * @returns {string|null} - Error message or null if valid
 */
export function validateMaxLength(value, max, fieldName) {
    if (value && value.length > max) {
        return `${fieldName} must be at most ${max} characters`;
    }
    return null;
}

/**
 * Validate a number is within range
 * @param {number} value - Value to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {string} fieldName - Name of the field for error message
 * @returns {string|null} - Error message or null if valid
 */
export function validateRange(value, min, max, fieldName) {
    const num = Number(value);
    if (isNaN(num)) {
        return `${fieldName} must be a number`;
    }
    if (num < min || num > max) {
        return `${fieldName} must be between ${min} and ${max}`;
    }
    return null;
}

/**
 * Validate a positive integer
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field for error message
 * @returns {string|null} - Error message or null if valid
 */
export function validatePositiveInt(value, fieldName) {
    const num = Number(value);
    if (isNaN(num) || !Number.isInteger(num) || num < 1) {
        return `${fieldName} must be a positive whole number`;
    }
    return null;
}

/**
 * Validate hex color code
 * @param {string} value - Value to validate
 * @param {string} fieldName - Name of the field for error message
 * @returns {string|null} - Error message or null if valid
 */
export function validateHexColor(value, fieldName) {
    if (value && !/^#[0-9A-Fa-f]{6}$/.test(value)) {
        return `${fieldName} must be a valid hex color (e.g., #FF5733)`;
    }
    return null;
}

/**
 * Validate date string (YYYY-MM-DD format)
 * @param {string} value - Value to validate
 * @param {string} fieldName - Name of the field for error message
 * @returns {string|null} - Error message or null if valid
 */
export function validateDate(value, fieldName) {
    if (!value) return null;
    
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return `${fieldName} must be in YYYY-MM-DD format`;
    }
    
    const date = new Date(value);
    if (isNaN(date.getTime())) {
        return `${fieldName} is not a valid date`;
    }
    
    return null;
}

/**
 * Validate booking data
 * @param {Object} data - Booking data
 * @returns {ValidationResult}
 */
export function validateBooking(data) {
    const errors = [];
    
    const dateError = validateRequired(data.date, 'Date') || validateDate(data.date, 'Date');
    if (dateError) errors.push(dateError);
    
    const teamError = validateRequired(data.teamId, 'Team');
    if (teamError) errors.push(teamError);
    
    if (data.notes) {
        const notesError = validateMaxLength(data.notes, 500, 'Notes');
        if (notesError) errors.push(notesError);
    }
    
    return { valid: errors.length === 0, errors };
}

/**
 * Validate team data
 * @param {Object} data - Team data
 * @returns {ValidationResult}
 */
export function validateTeam(data) {
    const errors = [];
    
    const nameError = validateRequired(data.name, 'Team name') 
        || validateMinLength(data.name, 2, 'Team name')
        || validateMaxLength(data.name, 100, 'Team name');
    if (nameError) errors.push(nameError);
    
    const locationError = validateRequired(data.locationId, 'Location');
    if (locationError) errors.push(locationError);
    
    const colorError = validateHexColor(data.color, 'Color');
    if (colorError) errors.push(colorError);
    
    const memberError = validatePositiveInt(data.memberCount, 'Member count')
        || validateRange(data.memberCount, 1, 1000, 'Member count');
    if (memberError) errors.push(memberError);
    
    if (data.manager) {
        const managerError = validateMaxLength(data.manager, 200, 'Manager name');
        if (managerError) errors.push(managerError);
    }
    
    return { valid: errors.length === 0, errors };
}

/**
 * Validate location data
 * @param {Object} data - Location data
 * @returns {ValidationResult}
 */
export function validateLocation(data) {
    const errors = [];
    
    const nameError = validateRequired(data.name, 'Location name')
        || validateMinLength(data.name, 2, 'Location name')
        || validateMaxLength(data.name, 100, 'Location name');
    if (nameError) errors.push(nameError);
    
    if (data.address) {
        const addressError = validateMaxLength(data.address, 500, 'Address');
        if (addressError) errors.push(addressError);
    }
    
    const capacityError = validatePositiveInt(data.capacity, 'Capacity')
        || validateRange(data.capacity, 1, 10000, 'Capacity');
    if (capacityError) errors.push(capacityError);
    
    if (data.floors !== undefined) {
        const floorsError = validatePositiveInt(data.floors, 'Floors')
            || validateRange(data.floors, 1, 100, 'Floors');
        if (floorsError) errors.push(floorsError);
    }
    
    return { valid: errors.length === 0, errors };
}

/**
 * Display validation errors as toast notifications
 * @param {ValidationResult} result - Validation result
 * @param {Function} showToast - Toast notification function
 * @returns {boolean} - Whether validation passed
 */
export function showValidationErrors(result, showToast) {
    if (!result.valid && result.errors.length > 0) {
        showToast(result.errors[0], 'error');
        return false;
    }
    return true;
}

