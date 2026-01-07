/**
 * Integration tests for /api/teams routes
 */
const request = require('supertest');
const express = require('express');

jest.mock('../../config/supabase', () => require('../mocks/supabase.mock'));

const { mockData, resetMockData, setSimulateError, clearSimulateError } = require('../mocks/supabase.mock');
const teamsRouter = require('../../routes/teams');

const app = express();
app.use(express.json());
app.use('/api/teams', teamsRouter);

describe('POST /api/teams', () => {
    beforeEach(() => {
        resetMockData();
    });

    test('creates a new team with valid data', async () => {
        const newTeam = {
            name: 'Marketing',
            color: '#10b981',
            memberCount: 8,
            manager: 'Jane Doe',
            managerImage: 'https://example.com/jane.jpg',
            locationId: 'loc1'
        };

        const response = await request(app)
            .post('/api/teams')
            .send(newTeam)
            .expect('Content-Type', /json/)
            .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBe('Marketing');
        expect(response.body.memberCount).toBe(8);
    });

    test('creates team ID from name (slugified)', async () => {
        const newTeam = {
            name: 'Human Resources Team',
            locationId: 'loc1'
        };

        const response = await request(app)
            .post('/api/teams')
            .send(newTeam)
            .expect(201);

        expect(response.body.id).toBe('human-resources-team');
    });

    test('returns 400 when locationId is missing', async () => {
        const incompleteTeam = {
            name: 'Marketing'
            // Missing locationId
        };

        const response = await request(app)
            .post('/api/teams')
            .send(incompleteTeam)
            .expect(400);

        expect(response.body.error).toBe('Location is required');
    });

    test('uses default values for optional fields', async () => {
        const minimalTeam = {
            name: 'Minimal Team',
            locationId: 'loc1'
        };

        const response = await request(app)
            .post('/api/teams')
            .send(minimalTeam)
            .expect(201);

        expect(response.body.color).toBe('#6B7280');
        expect(response.body.memberCount).toBe(1);
        expect(response.body.manager).toBe('');
    });
});

describe('PUT /api/teams/:id', () => {
    beforeEach(() => {
        resetMockData();
    });

    test('updates an existing team', async () => {
        const updates = {
            name: 'Updated Engineering',
            memberCount: 15
        };

        const response = await request(app)
            .put('/api/teams/team1')
            .send(updates)
            .expect(200);

        expect(response.body.name).toBe('Updated Engineering');
        expect(response.body.memberCount).toBe(15);
    });

    test('updates manager fields', async () => {
        const updates = {
            manager: 'New Manager',
            managerImage: 'https://example.com/new.jpg'
        };

        const response = await request(app)
            .put('/api/teams/team1')
            .send(updates)
            .expect(200);

        expect(response.body.manager).toBe('New Manager');
    });

    test('returns 404 for non-existent team', async () => {
        const response = await request(app)
            .put('/api/teams/nonexistent')
            .send({ name: 'test' })
            .expect(404);

        expect(response.body.error).toBe('Team not found');
    });
});

describe('DELETE /api/teams/:id', () => {
    beforeEach(() => {
        resetMockData();
        mockData.bookings = [
            { id: 'b1', team_id: 'team1', date: '2024-01-15' }
        ];
    });

    test('deletes a team and its bookings', async () => {
        const response = await request(app)
            .delete('/api/teams/team1')
            .expect(200);

        expect(response.body.success).toBe(true);
    });

    test('returns success even for non-existent team', async () => {
        const response = await request(app)
            .delete('/api/teams/nonexistent')
            .expect(200);

        expect(response.body.success).toBe(true);
    });
});

describe('Error handling', () => {
    afterEach(() => {
        clearSimulateError();
        resetMockData();
    });

    test('POST /api/teams returns 500 on database error', async () => {
        setSimulateError(new Error('Database error'));

        const response = await request(app)
            .post('/api/teams')
            .send({ name: 'Test Team', locationId: 'loc1' })
            .expect(500);

        expect(response.body.error).toBe('Failed to create team');
    });

    test('PUT /api/teams/:id returns 500 on database error', async () => {
        setSimulateError(new Error('Database error'));

        const response = await request(app)
            .put('/api/teams/team1')
            .send({ name: 'Updated' })
            .expect(500);

        expect(response.body.error).toBe('Failed to update team');
    });

    test('DELETE /api/teams/:id returns 500 on database error', async () => {
        setSimulateError(new Error('Database error'));

        const response = await request(app)
            .delete('/api/teams/team1')
            .expect(500);

        expect(response.body.error).toBe('Failed to delete team');
    });
});


