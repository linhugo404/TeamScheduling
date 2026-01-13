/**
 * PostgreSQL Database Configuration
 * 
 * Replaces Supabase client with direct PostgreSQL connection using pg library.
 * Provides a Supabase-like API wrapper for minimal code changes.
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');

// Database configuration from environment variables
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'office_booking',
    user: process.env.DB_USER || 'office_app',
    password: process.env.DB_PASSWORD,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

// Validate required configuration
if (!dbConfig.password) {
    logger.error('❌ Missing PostgreSQL configuration!');
    logger.error('Please set DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD environment variables');
    process.exit(1);
}

// Create connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err) => {
    logger.error('Unexpected error on idle PostgreSQL client', err);
    process.exit(-1);
});

// Test connection on startup
pool.query('SELECT NOW()', (err) => {
    if (err) {
        logger.error('Failed to connect to PostgreSQL:', err.message);
        process.exit(1);
    } else {
        logger.info('✓ Connected to PostgreSQL database');
    }
});

/**
 * Unified Query Builder - supports both SELECT and mutations (INSERT/UPDATE/UPSERT/DELETE)
 */
class QueryBuilder {
    constructor(pool, table) {
        this.pool = pool;
        this.table = table;
        this.mode = 'select'; // 'select', 'insert', 'update', 'upsert', 'delete'
        this.selectFields = '*';
        this.where = [];
        this.orderBy = null;
        this.limitValue = null;
        this.singleResult = false;
        this.data = null;
        this.upsertOptions = {};
    }

    // SELECT operations
    select(fields = '*') {
        this.mode = 'select';
        this.selectFields = fields;
        return this;
    }

    // WHERE clauses
    eq(column, value) {
        this.where.push({ column, operator: '=', value });
        return this;
    }

    neq(column, value) {
        this.where.push({ column, operator: '!=', value });
        return this;
    }

    gt(column, value) {
        this.where.push({ column, operator: '>', value });
        return this;
    }

    gte(column, value) {
        this.where.push({ column, operator: '>=', value });
        return this;
    }

    lt(column, value) {
        this.where.push({ column, operator: '<', value });
        return this;
    }

    lte(column, value) {
        this.where.push({ column, operator: '<=', value });
        return this;
    }

    in(column, values) {
        this.where.push({ column, operator: 'IN', value: values });
        return this;
    }

    order(column, ascending = true) {
        this.orderBy = { column, ascending };
        return this;
    }

    limit(count) {
        this.limitValue = count;
        return this;
    }

    single() {
        this.singleResult = true;
        return this;
    }

    // MUTATION operations
    insert(data) {
        this.mode = 'insert';
        this.data = data;
        return this;
    }

    update(data) {
        this.mode = 'update';
        this.data = data;
        return this;
    }

    upsert(data, options = {}) {
        this.mode = 'upsert';
        this.data = data;
        this.upsertOptions = options;
        return this;
    }

    delete() {
        this.mode = 'delete';
        return this;
    }

    // Execute the query
    async execute() {
        try {
            if (this.mode === 'select') {
                return await this._executeSelect();
            } else if (this.mode === 'insert') {
                return await this._executeInsert();
            } else if (this.mode === 'update') {
                return await this._executeUpdate();
            } else if (this.mode === 'upsert') {
                return await this._executeUpsert();
            } else if (this.mode === 'delete') {
                return await this._executeDelete();
            }
        } catch (error) {
            logger.error(`PostgreSQL ${this.mode} error on ${this.table}:`, error);
            return { data: null, error };
        }
    }

    async _executeSelect() {
        let sql = `SELECT ${this.selectFields} FROM ${this.table}`;
        const params = [];
        let paramIndex = 1;

        // Build WHERE clause
        if (this.where.length > 0) {
            const conditions = this.where.map((condition) => {
                if (condition.operator === 'IN') {
                    const placeholders = condition.value.map((val) => {
                        params.push(val);
                        return `$${paramIndex++}`;
                    }).join(', ');
                    return `${condition.column} IN (${placeholders})`;
                } else {
                    params.push(condition.value);
                    return `${condition.column} ${condition.operator} $${paramIndex++}`;
                }
            });
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        // Add ORDER BY
        if (this.orderBy) {
            sql += ` ORDER BY ${this.orderBy.column} ${this.orderBy.ascending ? 'ASC' : 'DESC'}`;
        }

        // Add LIMIT
        if (this.limitValue) {
            params.push(this.limitValue);
            sql += ` LIMIT $${paramIndex++}`;
        }

        if (this.singleResult) {
            sql += ' LIMIT 1';
        }

        const result = await this.pool.query(sql, params);
        
        if (this.singleResult) {
            if (result.rows.length === 0) {
                return { data: null, error: { message: 'No rows returned', code: 'PGRST116' } };
            }
            return { data: result.rows[0], error: null };
        }
        
        return { data: result.rows, error: null };
    }

    async _executeInsert() {
        const columns = Object.keys(this.data);
        const values = Object.values(this.data);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `INSERT INTO ${this.table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING ${this.selectFields}`;
        
        const result = await this.pool.query(sql, values);
        
        if (this.singleResult) {
            return { data: result.rows[0] || null, error: null };
        }
        return { data: result.rows, error: null };
    }

    async _executeUpdate() {
        const setClause = Object.keys(this.data).map((key, i) => `${key} = $${i + 1}`).join(', ');
        const values = Object.values(this.data);
        let paramIndex = values.length + 1;
        
        const whereClause = this.where.map((condition) => {
            values.push(condition.value);
            return `${condition.column} ${condition.operator} $${paramIndex++}`;
        }).join(' AND ');
        
        const sql = `UPDATE ${this.table} SET ${setClause} WHERE ${whereClause} RETURNING ${this.selectFields}`;
        const result = await this.pool.query(sql, values);
        
        if (this.singleResult) {
            return { data: result.rows[0] || null, error: null };
        }
        return { data: result.rows, error: null };
    }

    async _executeUpsert() {
        const columns = Object.keys(this.data);
        const values = Object.values(this.data);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        
        // Get conflict column from options
        const conflictColumn = this.upsertOptions.onConflict || 'key';
        
        // Build UPDATE clause (exclude conflict column)
        const updateParts = columns
            .filter(col => col !== conflictColumn)
            .map((col, idx) => {
                const valueIndex = columns.indexOf(col) + 1;
                return `${col} = $${valueIndex}`;
            });
        
        // Add updated_at for settings table
        if (this.table === 'settings' && !columns.includes('updated_at')) {
            updateParts.push('updated_at = NOW()');
        } else if (this.data.updated_at !== undefined) {
            const updatedAtIndex = columns.indexOf('updated_at') + 1;
            updateParts.push(`updated_at = $${updatedAtIndex}`);
        }
        
        const sql = `INSERT INTO ${this.table} (${columns.join(', ')}) 
                     VALUES (${placeholders}) 
                     ON CONFLICT (${conflictColumn}) 
                     DO UPDATE SET ${updateParts.join(', ')} 
                     RETURNING ${this.selectFields}`;
        
        const result = await this.pool.query(sql, values);
        
        if (this.singleResult) {
            return { data: result.rows[0] || null, error: null };
        }
        return { data: result.rows, error: null };
    }

    async _executeDelete() {
        const values = [];
        let paramIndex = 1;
        
        const whereClause = this.where.map((condition) => {
            values.push(condition.value);
            return `${condition.column} ${condition.operator} $${paramIndex++}`;
        }).join(' AND ');
        
        const sql = `DELETE FROM ${this.table} WHERE ${whereClause} RETURNING ${this.selectFields}`;
        const result = await this.pool.query(sql, values);
        
        if (this.singleResult) {
            return { data: result.rows[0] || null, error: null };
        }
        return { data: result.rows, error: null };
    }
}

/**
 * Supabase-like client wrapper
 */
class PostgreSQLClient {
    constructor(pool) {
        this.pool = pool;
    }

    from(table) {
        return new QueryBuilder(this.pool, table);
    }

    /**
     * Execute raw query (for advanced use cases)
     */
    async query(text, params) {
        try {
            const result = await this.pool.query(text, params);
            return { data: result.rows, error: null };
        } catch (error) {
            logger.error('PostgreSQL raw query error:', error);
            return { data: null, error };
        }
    }
}

// Create client instance
const postgres = new PostgreSQLClient(pool);

// Export with Supabase-like API
module.exports = {
    // Main client (Supabase-compatible API)
    supabase: postgres,
    
    // Direct pool access for advanced queries
    pool,
    
    // Raw client for custom queries
    postgres,
};
