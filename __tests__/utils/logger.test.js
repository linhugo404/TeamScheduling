/**
 * Tests for utils/logger.js
 */

describe('logger', () => {
    let originalEnv;
    let logger;

    beforeEach(() => {
        // Store original environment
        originalEnv = process.env.NODE_ENV;
        // Clear module cache to get fresh logger instance
        jest.resetModules();
    });

    afterEach(() => {
        // Restore original environment
        process.env.NODE_ENV = originalEnv;
    });

    describe('in development mode', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'development';
            logger = require('../../utils/logger');
        });

        test('log() outputs to console without prefix', () => {
            const spy = jest.spyOn(console, 'log').mockImplementation();
            logger.log('test message');
            expect(spy).toHaveBeenCalledWith('test message');
            spy.mockRestore();
        });

        test('info() outputs to console with [INFO] prefix', () => {
            const spy = jest.spyOn(console, 'info').mockImplementation();
            logger.info('info message');
            expect(spy).toHaveBeenCalledWith('[INFO]', 'info message');
            spy.mockRestore();
        });

        test('warn() outputs to console with [WARN] prefix', () => {
            const spy = jest.spyOn(console, 'warn').mockImplementation();
            logger.warn('warning message');
            expect(spy).toHaveBeenCalledWith('[WARN]', 'warning message');
            spy.mockRestore();
        });

        test('error() outputs to console with [ERROR] prefix', () => {
            const spy = jest.spyOn(console, 'error').mockImplementation();
            logger.error('error message');
            expect(spy).toHaveBeenCalledWith('[ERROR]', 'error message');
            spy.mockRestore();
        });

        test('debug() outputs to console with [DEBUG] prefix', () => {
            const spy = jest.spyOn(console, 'debug').mockImplementation();
            logger.debug('debug message');
            expect(spy).toHaveBeenCalledWith('[DEBUG]', 'debug message');
            spy.mockRestore();
        });
    });

    describe('in production mode', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'production';
            logger = require('../../utils/logger');
        });

        test('log() does not output to console', () => {
            const spy = jest.spyOn(console, 'log').mockImplementation();
            logger.log('test message');
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });

        test('info() does not output to console', () => {
            const spy = jest.spyOn(console, 'info').mockImplementation();
            logger.info('info message');
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });

        test('warn() still outputs to console (always logged)', () => {
            const spy = jest.spyOn(console, 'warn').mockImplementation();
            logger.warn('warning message');
            expect(spy).toHaveBeenCalledWith('[WARN]', 'warning message');
            spy.mockRestore();
        });

        test('error() still outputs to console (always logged)', () => {
            const spy = jest.spyOn(console, 'error').mockImplementation();
            logger.error('error message');
            expect(spy).toHaveBeenCalledWith('[ERROR]', 'error message');
            spy.mockRestore();
        });

        test('debug() does not output to console', () => {
            const spy = jest.spyOn(console, 'debug').mockImplementation();
            logger.debug('debug message');
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe('with multiple arguments', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'development';
            logger = require('../../utils/logger');
        });

        test('log() passes multiple arguments to console.log', () => {
            const spy = jest.spyOn(console, 'log').mockImplementation();
            logger.log('message', { data: 'test' }, 123);
            expect(spy).toHaveBeenCalledWith('message', { data: 'test' }, 123);
            spy.mockRestore();
        });

        test('error() passes multiple arguments with prefix', () => {
            const spy = jest.spyOn(console, 'error').mockImplementation();
            logger.error('Error:', { code: 500 }, 'details');
            expect(spy).toHaveBeenCalledWith('[ERROR]', 'Error:', { code: 500 }, 'details');
            spy.mockRestore();
        });
    });
});
