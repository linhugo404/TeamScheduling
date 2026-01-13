-- PostgreSQL Schema for Office Booking System
-- Run this in your PostgreSQL database (not Supabase)
-- Usage: psql -U office_app -d office_booking -f postgresql-schema.sql

-- ============================================
-- LOCATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT DEFAULT '',
    capacity INTEGER DEFAULT 21,
    floors INTEGER DEFAULT 1,  -- Number of floors at this location
    floor_plan_width INTEGER,
    floor_plan_height INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TEAMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    manager TEXT DEFAULT '',
    manager_image TEXT DEFAULT '',
    color TEXT DEFAULT '#6B7280',
    member_count INTEGER DEFAULT 1,
    location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BOOKINGS TABLE (Team bookings)
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    people_count INTEGER NOT NULL,
    location_id TEXT REFERENCES locations(id) ON DELETE CASCADE,
    notes TEXT DEFAULT '',
    is_overbooked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_bookings_date_location ON bookings(date, location_id);
CREATE INDEX IF NOT EXISTS idx_bookings_team ON bookings(team_id);

-- ============================================
-- PUBLIC HOLIDAYS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public_holidays (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    name TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_holidays_date ON public_holidays(date);

-- ============================================
-- DESKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS desks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location_id TEXT REFERENCES locations(id) ON DELETE CASCADE,
    floor TEXT DEFAULT '1',
    zone TEXT DEFAULT '',
    x INTEGER DEFAULT 0,
    y INTEGER DEFAULT 0,
    width INTEGER DEFAULT 60,
    height INTEGER DEFAULT 40,
    desk_type TEXT DEFAULT 'hotseat', -- hotseat, team_seat, unavailable
    assigned_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
    chair_positions JSONB DEFAULT '["bottom"]'::jsonb,
    qr_code TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_desks_location ON desks(location_id);

-- ============================================
-- DESK BOOKINGS TABLE
-- ============================================
-- Note: start_time and end_time are now optional (full-day bookings by default)
CREATE TABLE IF NOT EXISTS desk_bookings (
    id TEXT PRIMARY KEY,
    desk_id TEXT REFERENCES desks(id) ON DELETE CASCADE,
    desk_name TEXT NOT NULL,
    location_id TEXT REFERENCES locations(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME, -- Optional: NULL means full-day booking
    end_time TIME,   -- Optional: NULL means full-day booking
    employee_name TEXT NOT NULL,
    employee_email TEXT DEFAULT '',
    team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
    checked_in BOOLEAN DEFAULT FALSE,
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_desk_bookings_date_location ON desk_bookings(date, location_id);
CREATE INDEX IF NOT EXISTS idx_desk_bookings_desk_date ON desk_bookings(desk_id, date);

-- ============================================
-- FLOOR ELEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS floor_elements (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, -- wall, room, label
    location_id TEXT REFERENCES locations(id) ON DELETE CASCADE,
    floor TEXT DEFAULT '1',
    x INTEGER DEFAULT 0,
    y INTEGER DEFAULT 0,
    width INTEGER DEFAULT 100,
    height INTEGER DEFAULT 100,
    rotation INTEGER DEFAULT 0, -- Rotation angle in degrees (for walls: 0=horizontal, 90=vertical, 45/-45=diagonal)
    points JSONB DEFAULT '[]'::jsonb,
    label TEXT DEFAULT '',
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_floor_elements_location ON floor_elements(location_id);

-- ============================================
-- SETTINGS TABLE (Application configuration)
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
-- Grant all privileges to application user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO office_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO office_app;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO office_app;

-- Grant privileges on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO office_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO office_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO office_app;

-- Note: Row Level Security (RLS) is a Supabase-specific feature
-- For PostgreSQL, use standard GRANT/REVOKE permissions instead
-- If you need RLS, you can enable it per table:
-- ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all on locations" ON locations FOR ALL USING (true) WITH CHECK (true);
