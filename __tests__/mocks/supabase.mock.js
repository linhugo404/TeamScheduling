/**
 * Supabase Mock
 * Provides a mock implementation for testing without a real database
 */

const mockData = {
    bookings: [],
    locations: [
        { id: 'loc1', name: 'Johannesburg', capacity: 50, floors: 2 },
        { id: 'loc2', name: 'Cape Town', capacity: 30, floors: 1 }
    ],
    teams: [
        { id: 'team1', name: 'Engineering', member_count: 10, color: '#4285f4', location_id: 'loc1' },
        { id: 'team2', name: 'Design', member_count: 5, color: '#ea4335', location_id: 'loc1' }
    ],
    holidays: [],
    desks: [],
    floor_elements: [],
    desk_bookings: []
};

// Reset mock data between tests
const resetMockData = () => {
    mockData.bookings = [];
    mockData.holidays = [];
    mockData.desks = [];
    mockData.floor_elements = [];
    mockData.desk_bookings = [];
};

// Create a chainable query builder mock
const createQueryBuilder = (tableName) => {
    let data = [...(mockData[tableName] || [])];
    let filters = [];
    let selectFields = '*';
    let isSingle = false;
    let insertData = null;
    let updateData = null;
    let deleteMode = false;

    const queryBuilder = {
        select: jest.fn((fields = '*') => {
            selectFields = fields;
            return queryBuilder;
        }),
        insert: jest.fn((newData) => {
            insertData = newData;
            return queryBuilder;
        }),
        update: jest.fn((updates) => {
            updateData = updates;
            return queryBuilder;
        }),
        delete: jest.fn(() => {
            deleteMode = true;
            return queryBuilder;
        }),
        eq: jest.fn((field, value) => {
            filters.push({ field, op: 'eq', value });
            return queryBuilder;
        }),
        neq: jest.fn((field, value) => {
            filters.push({ field, op: 'neq', value });
            return queryBuilder;
        }),
        gte: jest.fn((field, value) => {
            filters.push({ field, op: 'gte', value });
            return queryBuilder;
        }),
        lte: jest.fn((field, value) => {
            filters.push({ field, op: 'lte', value });
            return queryBuilder;
        }),
        single: jest.fn(() => {
            isSingle = true;
            return queryBuilder;
        }),
        // Execute the query and return results
        then: async (resolve, reject) => {
            try {
                let result = [...(mockData[tableName] || [])];

                // Apply filters
                for (const filter of filters) {
                    const snakeField = filter.field;
                    result = result.filter(item => {
                        const value = item[snakeField];
                        switch (filter.op) {
                            case 'eq': return value === filter.value;
                            case 'neq': return value !== filter.value;
                            case 'gte': return value >= filter.value;
                            case 'lte': return value <= filter.value;
                            default: return true;
                        }
                    });
                }

                // Handle insert
                if (insertData) {
                    const newItem = { ...insertData };
                    mockData[tableName].push(newItem);
                    result = [newItem];
                }

                // Handle update
                if (updateData) {
                    mockData[tableName] = mockData[tableName].map(item => {
                        const matches = filters.every(f => item[f.field] === f.value);
                        return matches ? { ...item, ...updateData } : item;
                    });
                    result = mockData[tableName].filter(item => 
                        filters.every(f => item[f.field] === f.value)
                    );
                }

                // Handle delete
                if (deleteMode) {
                    const toDelete = result;
                    mockData[tableName] = mockData[tableName].filter(item => 
                        !filters.every(f => item[f.field] === f.value)
                    );
                    result = toDelete;
                }

                // Return single item or array
                const output = isSingle ? (result[0] || null) : result;
                resolve({ data: output, error: null });
            } catch (error) {
                resolve({ data: null, error });
            }
        }
    };

    return queryBuilder;
};

// Mock Supabase client
const supabaseMock = {
    from: jest.fn((tableName) => createQueryBuilder(tableName)),
    auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null })
    }
};

module.exports = {
    supabase: supabaseMock,
    mockData,
    resetMockData
};

