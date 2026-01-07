/**
 * Integration tests for /api/holidays routes
 */
const request = require('supertest');
const express = require('express');

jest.mock('../../config/supabase', () => require('../mocks/supabase.mock'));

// Mock https module for external API calls
jest.mock('https', () => ({
    get: jest.fn((url, callback) => {
        const mockResponse = {
            on: jest.fn((event, handler) => {
                if (event === 'data') {
                    handler(JSON.stringify([
                        { date: '2024-01-01', name: 'New Year', localName: 'New Year\'s Day' },
                        { date: '2024-03-21', name: 'Human Rights Day', localName: 'Human Rights Day' }
                    ]));
                }
                if (event === 'end') {
                    handler();
                }
                return mockResponse;
            })
        };
        callback(mockResponse);
        return { on: jest.fn() };
    })
}));

const { mockData, resetMockData, setSimulateError, clearSimulateError } = require('../mocks/supabase.mock');
const holidaysRouter = require('../../routes/holidays');

const app = express();
app.use(express.json());
app.use('/api/holidays', holidaysRouter);

describe('GET /api/holidays/fetch/:year', () => {
    beforeEach(() => {
        resetMockData();
    });

    test('fetches holidays from external API', async () => {
        const response = await request(app)
            .get('/api/holidays/fetch/2024')
            .expect('Content-Type', /json/)
            .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBe(2);
        expect(response.body[0]).toHaveProperty('date');
        expect(response.body[0]).toHaveProperty('name');
    });

    test('uses localName when available', async () => {
        const response = await request(app)
            .get('/api/holidays/fetch/2024')
            .expect(200);

        expect(response.body[0].name).toBe("New Year's Day");
    });

    test('accepts country query parameter', async () => {
        const response = await request(app)
            .get('/api/holidays/fetch/2024?country=US')
            .expect(200);

        expect(response.body).toBeInstanceOf(Array);
    });
});

describe('POST /api/holidays', () => {
    beforeEach(() => {
        resetMockData();
    });

    test('saves holidays to database', async () => {
        const holidays = {
            holidays: [
                { date: '2024-01-01', name: 'New Year\'s Day' },
                { date: '2024-12-25', name: 'Christmas Day' }
            ]
        };

        const response = await request(app)
            .post('/api/holidays')
            .send(holidays)
            .expect('Content-Type', /json/)
            .expect(200);

        expect(response.body).toBeInstanceOf(Array);
    });
});

describe('DELETE /api/holidays/:date', () => {
    beforeEach(() => {
        resetMockData();
        mockData.public_holidays = [
            { date: '2024-01-01', name: 'New Year\'s Day' }
        ];
    });

    test('deletes a holiday by date', async () => {
        const response = await request(app)
            .delete('/api/holidays/2024-01-01')
            .expect(200);

        expect(response.body.success).toBe(true);
    });

    test('returns success even for non-existent holiday', async () => {
        const response = await request(app)
            .delete('/api/holidays/2099-01-01')
            .expect(200);

        expect(response.body.success).toBe(true);
    });
});

describe('Error handling', () => {
    afterEach(() => {
        clearSimulateError();
        resetMockData();
    });

    test('POST /api/holidays returns 500 on database error', async () => {
        setSimulateError(new Error('Database error'));

        const response = await request(app)
            .post('/api/holidays')
            .send({ holidays: [{ date: '2024-01-01', name: 'New Year' }] })
            .expect(500);

        expect(response.body.error).toBe('Failed to update holidays');
    });

    test('DELETE /api/holidays/:date returns 500 on database error', async () => {
        setSimulateError(new Error('Database error'));

        const response = await request(app)
            .delete('/api/holidays/2024-01-01')
            .expect(500);

        expect(response.body.error).toBe('Failed to delete holiday');
    });
});


