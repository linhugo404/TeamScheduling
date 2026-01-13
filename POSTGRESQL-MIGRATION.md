# 🔄 PostgreSQL Migration Guide

Step-by-step guide to migrate from Supabase to local PostgreSQL.

---

## 📋 Overview

This migration involves:
1. Installing PostgreSQL on Windows VM
2. Creating database and schema
3. Updating application code to use PostgreSQL client
4. Testing all functionality

**Estimated Time:** 30-60 minutes

---

## 🚀 Migration Steps

### Step 1: Install PostgreSQL

Follow `POSTGRESQL-SETUP.md` to:
- Install PostgreSQL
- Create database `office_booking`
- Create user `office_app`
- Initialize schema

### Step 2: Install PostgreSQL Driver

```powershell
# Install pg (PostgreSQL client for Node.js)
npm install pg

# Optional: Remove Supabase if not needed elsewhere
npm uninstall @supabase/supabase-js
```

### Step 3: Update Environment Variables

Edit your `.env` file:

**Remove:**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-service-role-key
```

**Add:**
```env
# PostgreSQL Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=office_booking
DB_USER=office_app
DB_PASSWORD=your_secure_password_here
```

### Step 4: Replace Database Config

The application uses `config/supabase.js`. You have two options:

#### Option A: Replace File (Recommended)

1. **Backup existing config:**
   ```powershell
   Copy-Item config\supabase.js config\supabase.js.backup
   ```

2. **Replace with PostgreSQL config:**
   ```powershell
   Copy-Item config\postgresql.js config\supabase.js
   ```

   Or manually update `config/supabase.js` to use PostgreSQL (see `config/postgresql.js`)

#### Option B: Update Existing File

Edit `config/supabase.js` and replace contents with PostgreSQL client code from `config/postgresql.js`.

### Step 5: Update Route Files

The PostgreSQL adapter (`config/postgresql.js`) provides a Supabase-compatible API, so **most route files should work without changes**.

However, you may need to update some queries. Check each route file:

#### Files to Review:

- ✅ `routes/data.js` - Should work as-is
- ✅ `routes/bookings.js` - Should work as-is
- ✅ `routes/locations.js` - Should work as-is
- ✅ `routes/teams.js` - Should work as-is
- ✅ `routes/holidays.js` - Should work as-is
- ✅ `routes/desks.js` - Should work as-is
- ✅ `routes/deskBookings.js` - Should work as-is
- ✅ `routes/floorElements.js` - Should work as-is
- ✅ `routes/settings.js` - Should work as-is

#### Common Issues & Fixes:

**Issue 1: `.insert()` with `.select().single()`**

**Before (Supabase):**
```javascript
const { data, error } = await supabase
    .from('bookings')
    .insert(newBooking)
    .select()
    .single();
```

**After (PostgreSQL adapter):**
```javascript
// The adapter handles this automatically
const { data, error } = await supabase
    .from('bookings')
    .insert(newBooking)
    .select()
    .single();
```

**Issue 2: Complex queries**

If you have complex queries that don't work with the adapter, use raw SQL:

```javascript
const { pool } = require('../config/supabase'); // Now PostgreSQL

// Raw query example
const result = await pool.query(
    'SELECT * FROM bookings WHERE date >= $1 AND date <= $2',
    [startDate, endDate]
);
```

**Issue 3: Upsert operations**

**Before (Supabase):**
```javascript
const { data, error } = await supabase
    .from('settings')
    .upsert({ key: 'team_roles', value: roles });
```

**After (PostgreSQL):**
```javascript
const { pool } = require('../config/supabase');
const { data, error } = await pool.query(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) 
     DO UPDATE SET value = $2, updated_at = NOW()
     RETURNING *`,
    ['team_roles', JSON.stringify(roles)]
);
```

### Step 6: Update Server.js

Check `server.js` for any Supabase-specific code:

**Line 146-184:** QR code check-in route uses Supabase directly. This should work with the adapter, but verify.

### Step 7: Update Tests

The test mocks (`__tests__/mocks/supabase.mock.js`) should still work since they mock the same API. However, you may want to update them to reflect PostgreSQL behavior.

**Optional:** Update mock to use PostgreSQL test database:

```javascript
// In __tests__/setup.js
const { Pool } = require('pg');

// Create test database connection
const testPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_TEST_NAME || 'office_booking_test',
    user: process.env.DB_USER || 'office_app',
    password: process.env.DB_PASSWORD,
});

// Use test pool in mocks
```

### Step 8: Migrate Data (If Needed)

If you have existing data in Supabase:

1. **Export from Supabase:**
   ```sql
   -- In Supabase SQL Editor, export each table
   COPY (SELECT * FROM locations) TO STDOUT WITH CSV HEADER;
   ```

2. **Import to PostgreSQL:**
   ```powershell
   # Using psql
   psql -U office_app -d office_booking -c "\COPY locations FROM 'locations.csv' WITH CSV HEADER"
   ```

   Or use pgAdmin's import/export feature.

### Step 9: Test Application

1. **Start the application:**
   ```powershell
   npm start
   ```

2. **Test all endpoints:**
   - GET `/api/data` - Should return all data
   - GET `/api/bookings` - Should return bookings
   - POST `/api/bookings` - Should create booking
   - Test all CRUD operations

3. **Check logs for errors:**
   ```powershell
   # With PM2
   pm2 logs office-booking
   ```

### Step 10: Update Documentation

Update any documentation that references Supabase:
- `README.md` - Update database section
- `WINDOWS-DEPLOYMENT.md` - Already updated
- Any deployment guides

---

## 🔍 Verification Checklist

- [ ] PostgreSQL installed and running
- [ ] Database `office_booking` created
- [ ] Schema initialized (`postgresql-schema.sql`)
- [ ] `.env` file updated with PostgreSQL credentials
- [ ] `pg` package installed
- [ ] `config/supabase.js` replaced/updated with PostgreSQL client
- [ ] All route files reviewed (no breaking changes)
- [ ] Application starts without errors
- [ ] GET `/api/data` returns data
- [ ] POST `/api/bookings` creates booking
- [ ] All CRUD operations work
- [ ] Tests pass (if updated)
- [ ] Data migrated (if applicable)

---

## 🐛 Troubleshooting

### Connection Errors

**Error: "password authentication failed"**
- Verify username/password in `.env`
- Check PostgreSQL user exists: `psql -U postgres -c "\du"`
- Reset password if needed: `ALTER USER office_app WITH PASSWORD 'new_password';`

**Error: "database does not exist"**
- Create database: `CREATE DATABASE office_booking;`
- Verify: `psql -U office_app -d office_booking`

**Error: "relation does not exist"**
- Run schema: `psql -U office_app -d office_booking -f postgresql-schema.sql`
- Verify tables: `psql -U office_app -d office_booking -c "\dt"`

### Query Errors

**Error: "column does not exist"**
- Check table schema: `psql -U office_app -d office_booking -c "\d table_name"`
- Verify column names match (PostgreSQL is case-sensitive for quoted identifiers)

**Error: "syntax error"**
- Check query syntax in route file
- Use parameterized queries (already done in adapter)

### Performance Issues

- Check PostgreSQL logs for slow queries
- Add indexes if needed (see `postgresql-schema.sql`)
- Tune PostgreSQL configuration (see `POSTGRESQL-SETUP.md`)

---

## 🔄 Rollback Plan

If you need to rollback to Supabase:

1. **Restore Supabase config:**
   ```powershell
   Copy-Item config\supabase.js.backup config\supabase.js
   ```

2. **Update `.env`:**
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SECRET_KEY=your-service-role-key
   ```

3. **Reinstall Supabase:**
   ```powershell
   npm install @supabase/supabase-js
   ```

4. **Restart application**

---

## 📚 Additional Notes

### Differences from Supabase

1. **No Row Level Security (RLS):** PostgreSQL adapter doesn't enforce RLS. Use standard GRANT/REVOKE permissions.

2. **No Real-time Subscriptions:** Supabase provides real-time features. For PostgreSQL, use Socket.IO (already implemented).

3. **No Storage API:** If you use Supabase Storage, you'll need an alternative (local filesystem, S3, etc.).

4. **Connection Pooling:** The adapter uses `pg` Pool for connection management.

### Performance Considerations

- PostgreSQL adapter adds a small overhead compared to direct SQL
- For high-performance needs, consider using raw SQL queries
- Connection pooling is handled automatically by `pg` Pool

---

**🎉 Migration Complete!**

Your application should now be running on local PostgreSQL instead of Supabase.
