/**
 * Integration tests for /api/data routes
 */
const request = require('supertest');
const express = require('express');

jest.mock('../../config/supabase', () => require('../mocks/supabase.mock'));

const { mockData, resetMockData, setSimulateError, clearSimulateError } = require('../mocks/supabase.mock');
const dataRouter = require('../../routes/data');

const app = express();
app.use(express.json());
app.use('/api/data', dataRouter);

describe('GET /api/data', () => {
    beforeEach(() => {
        resetMockData();
        // Add some test data
        mockData.bookings = [
            { id: 'b1', date: '2024-01-15', team_id: 'team1', location_id: 'loc1' }
        ];
        mockData.public_holidays = [
            { date: '2024-01-01', name: 'New Year\'s Day' }
        ];
        mockData.desks = [
            { id: 'd1', name: 'Desk 1', location_id: 'loc1' }
        ];
        mockData.desk_bookings = [];
        mockData.floor_elements = [];
    });

    test('returns all data for initial app load', async () => {
        const response = await request(app)
            .get('/api/data')
            .expect('Content-Type', /json/)
            .expect(200);

        expect(response.body).toHaveProperty('locations');
        expect(response.body).toHaveProperty('teams');
        expect(response.body).toHaveProperty('bookings');
        expect(response.body).toHaveProperty('publicHolidays');
        expect(response.body).toHaveProperty('desks');
        expect(response.body).toHaveProperty('deskBookings');
        expect(response.body).toHaveProperty('floorElements');
    });

    test('returns locations array', async () => {
        const response = await request(app)
            .get('/api/data')
            .expect(200);

        expect(response.body.locations).toBeInstanceOf(Array);
        expect(response.body.locations.length).toBe(2);
    });

    test('returns teams array', async () => {
        const response = await request(app)
            .get('/api/data')
            .expect(200);

        expect(response.body.teams).toBeInstanceOf(Array);
        expect(response.body.teams.length).toBe(2);
    });

    test('returns bookings with camelCase keys', async () => {
        const response = await request(app)
            .get('/api/data')
            .expect(200);

        expect(response.body.bookings.length).toBe(1);
        expect(response.body.bookings[0]).toHaveProperty('teamId');
        expect(response.body.bookings[0]).toHaveProperty('locationId');
    });

    test('returns holidays with camelCase keys', async () => {
        const response = await request(app)
            .get('/api/data')
            .expect(200);

        expect(response.body.publicHolidays.length).toBe(1);
    });

    test('returns desks array', async () => {
        const response = await request(app)
            .get('/api/data')
            .expect(200);

        expect(response.body.desks).toBeInstanceOf(Array);
        expect(response.body.desks.length).toBe(1);
    });
});

describe('Error handling', () => {
    afterEach(() => {
        clearSimulateError();
        resetMockData();
    });

    test('GET /api/data returns 500 on database error', async () => {
        setSimulateError(new Error('Database connection failed'));

        const response = await request(app)
            .get('/api/data')
            .expect(500);

        expect(response.body.error).toBe('Failed to read data');
    });
});


