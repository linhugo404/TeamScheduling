/**
 * Jest Setup File
 * Runs before each test file
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Suppress console output during tests (optional)
// global.console = {
//     ...console,
//     log: jest.fn(),
//     info: jest.fn(),
//     warn: jest.fn(),
//     // Keep error for debugging
//     error: console.error
// };

// Global test utilities
global.createMockResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis()
});

global.createMockRequest = (overrides = {}) => ({
    params: {},
    query: {},
    body: {},
    ...overrides
});

