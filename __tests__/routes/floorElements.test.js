/**
 * Integration tests for /api/floor-elements routes
 */
const request = require('supertest');
const express = require('express');

jest.mock('../../config/supabase', () => require('../mocks/supabase.mock'));

const { mockData, resetMockData, setSimulateError, clearSimulateError } = require('../mocks/supabase.mock');
const floorElementsRouter = require('../../routes/floorElements');

const app = express();
app.use(express.json());
app.use('/api/floor-elements', floorElementsRouter);

describe('GET /api/floor-elements', () => {
    beforeEach(() => {
        resetMockData();
        mockData.floor_elements = [
            { id: 'fe1', type: 'room', location_id: 'loc1', floor: '1', label: 'Meeting Room A' },
            { id: 'fe2', type: 'wall', location_id: 'loc1', floor: '1' },
            { id: 'fe3', type: 'room', location_id: 'loc1', floor: '2', label: 'Meeting Room B' },
            { id: 'fe4', type: 'wall', location_id: 'loc2', floor: '1' }
        ];
    });

    test('returns all floor elements when no filter', async () => {
        const response = await request(app)
            .get('/api/floor-elements')
            .expect('Content-Type', /json/)
            .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBe(4);
    });

    test('filters by locationId', async () => {
        const response = await request(app)
            .get('/api/floor-elements?locationId=loc1')
            .expect(200);

        expect(response.body.length).toBe(3);
        expect(response.body.every(e => e.locationId === 'loc1')).toBe(true);
    });

    test('filters by floor', async () => {
        const response = await request(app)
            .get('/api/floor-elements?floor=1')
            .expect(200);

        expect(response.body.length).toBe(3);
        expect(response.body.every(e => e.floor === '1')).toBe(true);
    });

    test('filters by both locationId and floor', async () => {
        const response = await request(app)
            .get('/api/floor-elements?locationId=loc1&floor=1')
            .expect(200);

        expect(response.body.length).toBe(2);
    });

    test('returns camelCase keys', async () => {
        const response = await request(app)
            .get('/api/floor-elements')
            .expect(200);

        expect(response.body[0]).toHaveProperty('locationId');
    });
});

describe('POST /api/floor-elements', () => {
    beforeEach(() => {
        resetMockData();
    });

    test('creates a new room element', async () => {
        const newElement = {
            type: 'room',
            locationId: 'loc1',
            floor: '1',
            x: 100,
            y: 200,
            width: 150,
            height: 100,
            label: 'Conference Room'
        };

        const response = await request(app)
            .post('/api/floor-elements')
            .send(newElement)
            .expect('Content-Type', /json/)
            .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.type).toBe('room');
        expect(response.body.label).toBe('Conference Room');
    });

    test('creates a wall element', async () => {
        const newElement = {
            type: 'wall',
            locationId: 'loc1',
            points: [{ x: 0, y: 0 }, { x: 100, y: 0 }]
        };

        const response = await request(app)
            .post('/api/floor-elements')
            .send(newElement)
            .expect(201);

        expect(response.body.type).toBe('wall');
    });

    test('returns 400 when type is missing', async () => {
        const response = await request(app)
            .post('/api/floor-elements')
            .send({ locationId: 'loc1' })
            .expect(400);

        expect(response.body.error).toBe('Type and location are required');
    });

    test('returns 400 when locationId is missing', async () => {
        const response = await request(app)
            .post('/api/floor-elements')
            .send({ type: 'room' })
            .expect(400);

        expect(response.body.error).toBe('Type and location are required');
    });

    test('uses default values for optional fields', async () => {
        const minimalElement = {
            type: 'room',
            locationId: 'loc1'
        };

        const response = await request(app)
            .post('/api/floor-elements')
            .send(minimalElement)
            .expect(201);

        expect(response.body.floor).toBe('1');
        expect(response.body.x).toBe(0);
        expect(response.body.y).toBe(0);
        expect(response.body.width).toBe(100);
        expect(response.body.height).toBe(100);
        expect(response.body.rotation).toBe(0);
        expect(response.body.label).toBe('');
    });
});

describe('PUT /api/floor-elements/:id', () => {
    beforeEach(() => {
        resetMockData();
        mockData.floor_elements = [
            { id: 'fe1', type: 'room', location_id: 'loc1', floor: '1', x: 0, y: 0, width: 100, height: 100, label: 'Room A' }
        ];
    });

    test('updates element position', async () => {
        const updates = {
            x: 200,
            y: 300
        };

        const response = await request(app)
            .put('/api/floor-elements/fe1')
            .send(updates)
            .expect(200);

        expect(response.body.x).toBe(200);
        expect(response.body.y).toBe(300);
    });

    test('updates element properties', async () => {
        const updates = {
            label: 'Updated Room',
            color: '#ff0000',
            rotation: 45
        };

        const response = await request(app)
            .put('/api/floor-elements/fe1')
            .send(updates)
            .expect(200);

        expect(response.body.label).toBe('Updated Room');
    });

    test('updates element dimensions', async () => {
        const updates = {
            width: 200,
            height: 150
        };

        const response = await request(app)
            .put('/api/floor-elements/fe1')
            .send(updates)
            .expect(200);

        expect(response.body.width).toBe(200);
        expect(response.body.height).toBe(150);
    });

    test('returns 404 for non-existent element', async () => {
        const response = await request(app)
            .put('/api/floor-elements/nonexistent')
            .send({ label: 'test' })
            .expect(404);

        expect(response.body.error).toBe('Element not found');
    });
});

describe('DELETE /api/floor-elements/:id', () => {
    beforeEach(() => {
        resetMockData();
        mockData.floor_elements = [
            { id: 'fe1', type: 'room', location_id: 'loc1' }
        ];
    });

    test('deletes a floor element', async () => {
        const response = await request(app)
            .delete('/api/floor-elements/fe1')
            .expect(200);

        expect(response.body.success).toBe(true);
    });

    test('returns success even for non-existent element', async () => {
        const response = await request(app)
            .delete('/api/floor-elements/nonexistent')
            .expect(200);

        expect(response.body.success).toBe(true);
    });
});

describe('Error handling', () => {
    afterEach(() => {
        clearSimulateError();
        resetMockData();
    });

    test('GET /api/floor-elements returns 500 on database error', async () => {
        setSimulateError(new Error('Database error'));

        const response = await request(app)
            .get('/api/floor-elements')
            .expect(500);

        expect(response.body.error).toBe('Failed to get floor elements');
    });

    test('POST /api/floor-elements returns 500 on database error', async () => {
        setSimulateError(new Error('Database error'));

        const response = await request(app)
            .post('/api/floor-elements')
            .send({ type: 'room', locationId: 'loc1' })
            .expect(500);

        expect(response.body.error).toBe('Failed to create floor element');
    });

    test('PUT /api/floor-elements/:id returns 500 on database error', async () => {
        setSimulateError(new Error('Database error'));

        const response = await request(app)
            .put('/api/floor-elements/fe1')
            .send({ label: 'Updated' })
            .expect(500);

        expect(response.body.error).toBe('Failed to update floor element');
    });

    test('DELETE /api/floor-elements/:id returns 500 on database error', async () => {
        setSimulateError(new Error('Database error'));

        const response = await request(app)
            .delete('/api/floor-elements/fe1')
            .expect(500);

        expect(response.body.error).toBe('Failed to delete floor element');
    });
});


