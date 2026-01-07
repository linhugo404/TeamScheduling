/**
 * Jest Configuration
 */
module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.test.js'],
    collectCoverageFrom: [
        'routes/**/*.js',
        'utils/**/*.js',
        '!**/node_modules/**'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    verbose: true,
    testTimeout: 10000,
    // Setup file to run before tests
    setupFilesAfterEnv: ['./__tests__/setup.js'],
    // Clear mocks between tests
    clearMocks: true,
    // Module path aliases
    moduleDirectories: ['node_modules', '<rootDir>']
};

