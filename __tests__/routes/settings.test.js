/**
 * Settings Routes Tests
 */

const request = require('supertest');
const express = require('express');

// Mock Supabase before requiring routes
jest.mock('../../config/supabase', () => require('../mocks/supabase.mock'));

const settingsRoutes = require('../../routes/settings');
const { resetMockData, setMockData } = require('../mocks/supabase.mock');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/settings', settingsRoutes);

describe('Settings Routes', () => {
    beforeEach(() => {
        resetMockData();
    });

    describe('GET /api/settings/:key', () => {
        test('returns setting value when found', async () => {
            setMockData('settings', [
                { key: 'team_roles', value: ['Manager', 'Director'] }
            ]);

            const response = await request(app)
                .get('/api/settings/team_roles')
                .expect(200);

            expect(response.body.value).toEqual(['Manager', 'Director']);
        });

        test('returns default empty array for team_roles when not found', async () => {
            setMockData('settings', []);

            const response = await request(app)
                .get('/api/settings/team_roles')
                .expect(200);

            expect(response.body.value).toEqual([]);
        });

        test('returns null for unknown setting when not found', async () => {
            setMockData('settings', []);

            const response = await request(app)
                .get('/api/settings/unknown_key')
                .expect(200);

            expect(response.body.value).toBeNull();
        });

        test('handles database errors gracefully', async () => {
            setMockData('settings', 'error');

            const response = await request(app)
                .get('/api/settings/team_roles')
                .expect(500);

            expect(response.body.error).toBe('Failed to get setting');
        });
    });

    describe('PUT /api/settings/:key', () => {
        test('creates new setting', async () => {
            setMockData('settings', []);

            const response = await request(app)
                .put('/api/settings/team_roles')
                .send({ value: ['Manager'] })
                .expect(200);

            expect(response.body.value).toEqual(['Manager']);
        });

        test('updates existing setting', async () => {
            setMockData('settings', [
                { key: 'team_roles', value: ['Manager'] }
            ]);

            const response = await request(app)
                .put('/api/settings/team_roles')
                .send({ value: ['Manager', 'Director'] })
                .expect(200);

            expect(response.body.value).toEqual(['Manager', 'Director']);
        });

        test('returns 400 when value is missing', async () => {
            const response = await request(app)
                .put('/api/settings/team_roles')
                .send({})
                .expect(400);

            expect(response.body.error).toBe('Value is required');
        });

        test('returns 400 when team_roles is not an array', async () => {
            const response = await request(app)
                .put('/api/settings/team_roles')
                .send({ value: 'not an array' })
                .expect(400);

            expect(response.body.error).toBe('team_roles must be an array');
        });

        test('returns 400 when team_roles contains non-strings', async () => {
            const response = await request(app)
                .put('/api/settings/team_roles')
                .send({ value: ['Manager', 123, 'Director'] })
                .expect(400);

            expect(response.body.error).toBe('team_roles must be an array of strings');
        });

        test('allows non-team_roles settings with any value type', async () => {
            setMockData('settings', []);

            const response = await request(app)
                .put('/api/settings/custom_setting')
                .send({ value: { foo: 'bar', count: 42 } })
                .expect(200);

            expect(response.body.value).toEqual({ foo: 'bar', count: 42 });
        });

        test('handles database errors gracefully', async () => {
            setMockData('settings', 'error');

            const response = await request(app)
                .put('/api/settings/team_roles')
                .send({ value: ['Manager'] })
                .expect(500);

            expect(response.body.error).toBe('Failed to update setting');
        });
    });
});

