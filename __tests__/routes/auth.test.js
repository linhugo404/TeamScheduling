/**
 * Integration tests for /auth routes
 */
const request = require('supertest');
const express = require('express');
const path = require('path');

const authRouter = require('../../routes/auth');

const app = express();
app.use(express.json());
app.use('/auth', authRouter);

// Mock static file serving
app.use(express.static(path.join(__dirname, '../../public')));

describe('GET /auth/callback', () => {
    test('serves index.html for SPA auth redirect', async () => {
        const response = await request(app)
            .get('/auth/callback')
            .expect(200);

        // Should return HTML
        expect(response.type).toMatch(/html/);
    });
});

describe('GET /auth/config', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    test('returns 503 when Azure AD is not configured', async () => {
        delete process.env.AZURE_AD_CLIENT_ID;
        delete process.env.AZURE_AD_TENANT_ID;

        // Need to re-require the router after changing env
        jest.resetModules();
        const freshAuthRouter = require('../../routes/auth');
        const freshApp = express();
        freshApp.use(express.json());
        freshApp.use('/auth', freshAuthRouter);

        const response = await request(freshApp)
            .get('/auth/config')
            .expect(503);

        expect(response.body.error).toBe('Azure AD not configured');
        expect(response.body.configured).toBe(false);
    });

    test('returns config when Azure AD is configured', async () => {
        process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
        process.env.AZURE_AD_TENANT_ID = 'test-tenant-id';

        jest.resetModules();
        const freshAuthRouter = require('../../routes/auth');
        const freshApp = express();
        freshApp.use(express.json());
        freshApp.use('/auth', freshAuthRouter);

        const response = await request(freshApp)
            .get('/auth/config')
            .expect(200);

        expect(response.body.configured).toBe(true);
        expect(response.body.clientId).toBe('test-client-id');
        expect(response.body.authority).toBe('https://login.microsoftonline.com/test-tenant-id');
        expect(response.body.redirectUri).toContain('/auth/callback');
    });

    test('uses HTTP for localhost', async () => {
        process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
        process.env.AZURE_AD_TENANT_ID = 'test-tenant-id';

        jest.resetModules();
        const freshAuthRouter = require('../../routes/auth');
        const freshApp = express();
        freshApp.use(express.json());
        freshApp.use('/auth', freshAuthRouter);

        const response = await request(freshApp)
            .get('/auth/config')
            .set('Host', 'localhost:3000')
            .expect(200);

        expect(response.body.redirectUri).toMatch(/^http:\/\/localhost/);
    });

    test('uses HTTPS for non-localhost', async () => {
        process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
        process.env.AZURE_AD_TENANT_ID = 'test-tenant-id';

        jest.resetModules();
        const freshAuthRouter = require('../../routes/auth');
        const freshApp = express();
        freshApp.use(express.json());
        freshApp.use('/auth', freshAuthRouter);

        const response = await request(freshApp)
            .get('/auth/config')
            .set('Host', 'myapp.onrender.com')
            .expect(200);

        expect(response.body.redirectUri).toMatch(/^https:\/\/myapp\.onrender\.com/);
    });

    test('respects x-forwarded-proto header for non-localhost', async () => {
        process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
        process.env.AZURE_AD_TENANT_ID = 'test-tenant-id';

        jest.resetModules();
        const freshAuthRouter = require('../../routes/auth');
        const freshApp = express();
        freshApp.use(express.json());
        freshApp.use('/auth', freshAuthRouter);

        const response = await request(freshApp)
            .get('/auth/config')
            .set('Host', 'myapp.example.com')
            .set('X-Forwarded-Proto', 'https')
            .expect(200);

        // Non-localhost should always use HTTPS
        expect(response.body.redirectUri).toMatch(/^https:\/\/myapp\.example\.com/);
    });
});


