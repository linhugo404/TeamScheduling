/**
 * Integration tests for /api/locations routes
 */
const request = require('supertest');
const express = require('express');

jest.mock('../../config/supabase', () => require('../mocks/supabase.mock'));

const { mockData, resetMockData, setSimulateError, clearSimulateError } = require('../mocks/supabase.mock');
const locationsRouter = require('../../routes/locations');

const app = express();
app.use(express.json());
app.use('/api/locations', locationsRouter);

describe('POST /api/locations', () => {
    beforeEach(() => {
        resetMockData();
    });

    test('creates a new location with valid data', async () => {
        const newLocation = {
            name: 'Durban Office',
            address: '123 Beach Road, Durban',
            capacity: 40,
            floors: 3
        };

        const response = await request(app)
            .post('/api/locations')
            .send(newLocation)
            .expect('Content-Type', /json/)
            .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBe('Durban Office');
        expect(response.body.capacity).toBe(40);
        expect(response.body.floors).toBe(3);
    });

    test('creates location ID from name (slugified)', async () => {
        const newLocation = {
            name: 'New York City HQ'
        };

        const response = await request(app)
            .post('/api/locations')
            .send(newLocation)
            .expect(201);

        expect(response.body.id).toBe('new-york-city-hq');
    });

    test('uses default values for optional fields', async () => {
        const minimalLocation = {
            name: 'Minimal Office'
        };

        const response = await request(app)
            .post('/api/locations')
            .send(minimalLocation)
            .expect(201);

        expect(response.body.address).toBe('');
        expect(response.body.capacity).toBe(21);
        expect(response.body.floors).toBe(1);
    });
});

describe('PUT /api/locations/:id', () => {
    beforeEach(() => {
        resetMockData();
    });

    test('updates an existing location', async () => {
        const updates = {
            name: 'Updated Johannesburg',
            capacity: 75
        };

        const response = await request(app)
            .put('/api/locations/loc1')
            .send(updates)
            .expect(200);

        expect(response.body.name).toBe('Updated Johannesburg');
        expect(response.body.capacity).toBe(75);
    });

    test('updates floor plan dimensions', async () => {
        const updates = {
            floorPlanWidth: 1200,
            floorPlanHeight: 800
        };

        const response = await request(app)
            .put('/api/locations/loc1')
            .send(updates)
            .expect(200);

        expect(response.body).toBeDefined();
    });

    test('returns 404 for non-existent location', async () => {
        const response = await request(app)
            .put('/api/locations/nonexistent')
            .send({ name: 'test' })
            .expect(404);

        expect(response.body.error).toBe('Location not found');
    });
});

describe('DELETE /api/locations/:id', () => {
    beforeEach(() => {
        resetMockData();
        mockData.bookings = [
            { id: 'b1', location_id: 'loc1', date: '2024-01-15' }
        ];
    });

    test('deletes a location and its bookings', async () => {
        const response = await request(app)
            .delete('/api/locations/loc1')
            .expect(200);

        expect(response.body.success).toBe(true);
    });

    test('returns success even for non-existent location', async () => {
        const response = await request(app)
            .delete('/api/locations/nonexistent')
            .expect(200);

        expect(response.body.success).toBe(true);
    });
});

describe('Error handling', () => {
    afterEach(() => {
        clearSimulateError();
        resetMockData();
    });

    test('POST /api/locations returns 500 on database error', async () => {
        setSimulateError(new Error('Database error'));

        const response = await request(app)
            .post('/api/locations')
            .send({ name: 'Test Location' })
            .expect(500);

        expect(response.body.error).toBe('Failed to create location');
    });

    test('PUT /api/locations/:id returns 500 on database error', async () => {
        setSimulateError(new Error('Database error'));

        const response = await request(app)
            .put('/api/locations/loc1')
            .send({ name: 'Updated' })
            .expect(500);

        expect(response.body.error).toBe('Failed to update location');
    });

    test('DELETE /api/locations/:id returns 500 on database error', async () => {
        setSimulateError(new Error('Database error'));

        const response = await request(app)
            .delete('/api/locations/loc1')
            .expect(500);

        expect(response.body.error).toBe('Failed to delete location');
    });
});


