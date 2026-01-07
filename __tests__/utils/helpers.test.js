/**
 * Tests for utils/helpers.js
 */
const { toCamelCase, toSnakeCase } = require('../../utils/helpers');

describe('toCamelCase', () => {
    test('converts snake_case keys to camelCase', () => {
        const input = { user_name: 'John', created_at: '2024-01-01' };
        const expected = { userName: 'John', createdAt: '2024-01-01' };
        expect(toCamelCase(input)).toEqual(expected);
    });

    test('handles nested objects', () => {
        const input = { 
            user_info: { 
                first_name: 'John', 
                last_name: 'Doe' 
            } 
        };
        const expected = { 
            userInfo: { 
                firstName: 'John', 
                lastName: 'Doe' 
            } 
        };
        expect(toCamelCase(input)).toEqual(expected);
    });

    test('handles arrays of objects', () => {
        const input = [
            { team_id: '1', team_name: 'Engineering' },
            { team_id: '2', team_name: 'Design' }
        ];
        const expected = [
            { teamId: '1', teamName: 'Engineering' },
            { teamId: '2', teamName: 'Design' }
        ];
        expect(toCamelCase(input)).toEqual(expected);
    });

    test('returns primitives unchanged', () => {
        expect(toCamelCase('hello')).toBe('hello');
        expect(toCamelCase(123)).toBe(123);
        expect(toCamelCase(null)).toBe(null);
        expect(toCamelCase(undefined)).toBe(undefined);
    });

    test('handles keys with multiple underscores', () => {
        const input = { user_first_name: 'John' };
        const expected = { userFirstName: 'John' };
        expect(toCamelCase(input)).toEqual(expected);
    });

    test('handles empty objects', () => {
        expect(toCamelCase({})).toEqual({});
    });

    test('handles empty arrays', () => {
        expect(toCamelCase([])).toEqual([]);
    });
});

describe('toSnakeCase', () => {
    test('converts camelCase keys to snake_case', () => {
        const input = { userName: 'John', createdAt: '2024-01-01' };
        const expected = { user_name: 'John', created_at: '2024-01-01' };
        expect(toSnakeCase(input)).toEqual(expected);
    });

    test('handles nested objects', () => {
        const input = { 
            userInfo: { 
                firstName: 'John', 
                lastName: 'Doe' 
            } 
        };
        const expected = { 
            user_info: { 
                first_name: 'John', 
                last_name: 'Doe' 
            } 
        };
        expect(toSnakeCase(input)).toEqual(expected);
    });

    test('handles arrays of objects', () => {
        const input = [
            { teamId: '1', teamName: 'Engineering' },
            { teamId: '2', teamName: 'Design' }
        ];
        const expected = [
            { team_id: '1', team_name: 'Engineering' },
            { team_id: '2', team_name: 'Design' }
        ];
        expect(toSnakeCase(input)).toEqual(expected);
    });

    test('returns primitives unchanged', () => {
        expect(toSnakeCase('hello')).toBe('hello');
        expect(toSnakeCase(123)).toBe(123);
        expect(toSnakeCase(null)).toBe(null);
        expect(toSnakeCase(undefined)).toBe(undefined);
    });

    test('handles keys with consecutive capitals', () => {
        const input = { userID: '123' };
        const expected = { user_i_d: '123' }; // Expected behavior
        expect(toSnakeCase(input)).toEqual(expected);
    });

    test('handles empty objects', () => {
        expect(toSnakeCase({})).toEqual({});
    });

    test('handles empty arrays', () => {
        expect(toSnakeCase([])).toEqual([]);
    });
});

describe('toCamelCase and toSnakeCase symmetry', () => {
    test('round-trip conversion preserves data', () => {
        const original = { team_id: '1', team_name: 'Engineering', member_count: 10 };
        const camelCase = toCamelCase(original);
        const backToSnake = toSnakeCase(camelCase);
        expect(backToSnake).toEqual(original);
    });
});

