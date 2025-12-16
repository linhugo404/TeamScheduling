/**
 * Migration script to import existing JSON data into Supabase
 * 
 * Usage:
 * 1. Set your environment variables:
 *    export SUPABASE_URL=https://xxxxx.supabase.co
 *    export SUPABASE_SECRET_KEY=sb_secret_...
 * 
 * 2. Run the schema first in Supabase SQL Editor (supabase-schema.sql)
 * 
 * 3. Run this script:
 *    node migrate-to-supabase.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.error('❌ Missing environment variables!');
    console.error('Please set SUPABASE_URL and SUPABASE_SECRET_KEY');
    console.error('Example:');
    console.error('  export SUPABASE_URL=https://xxxxx.supabase.co');
    console.error('  export SUPABASE_SECRET_KEY=sb_secret_...');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

async function migrate() {
    console.log('🚀 Starting migration to Supabase...\n');

    // Read existing data
    const dataFile = path.join(__dirname, 'data', 'bookings.json');
    let data;
    
    try {
        const content = await fs.readFile(dataFile, 'utf8');
        data = JSON.parse(content);
        console.log('✅ Read existing data from bookings.json\n');
    } catch (error) {
        console.error('❌ Failed to read bookings.json:', error.message);
        process.exit(1);
    }

    // 1. Migrate locations (must be first due to foreign keys)
    if (data.locations && data.locations.length > 0) {
        console.log(`📍 Migrating ${data.locations.length} locations...`);
        const locations = data.locations.map(l => ({
            id: l.id,
            name: l.name,
            address: l.address || '',
            capacity: l.capacity || 21,
            floor_plan_width: l.floorPlanWidth || null,
            floor_plan_height: l.floorPlanHeight || null
        }));
        
        const { error } = await supabase.from('locations').upsert(locations);
        if (error) {
            console.error('❌ Error migrating locations:', error.message);
        } else {
            console.log('✅ Locations migrated successfully\n');
        }
    }

    // 2. Migrate teams
    if (data.teams && data.teams.length > 0) {
        console.log(`👥 Migrating ${data.teams.length} teams...`);
        const teams = data.teams.map(t => ({
            id: t.id,
            name: t.name,
            manager: t.manager || '',
            manager_image: t.managerImage || '',
            color: t.color || '#6B7280',
            member_count: t.memberCount || 1,
            location_id: t.locationId || null
        }));
        
        const { error } = await supabase.from('teams').upsert(teams);
        if (error) {
            console.error('❌ Error migrating teams:', error.message);
        } else {
            console.log('✅ Teams migrated successfully\n');
        }
    }

    // 3. Migrate bookings
    if (data.bookings && data.bookings.length > 0) {
        console.log(`📅 Migrating ${data.bookings.length} bookings...`);
        const bookings = data.bookings.map(b => ({
            id: b.id,
            date: b.date,
            team_id: b.teamId,
            team_name: b.teamName,
            people_count: b.peopleCount,
            location_id: b.locationId,
            notes: b.notes || '',
            created_at: b.createdAt || new Date().toISOString()
        }));
        
        const { error } = await supabase.from('bookings').upsert(bookings);
        if (error) {
            console.error('❌ Error migrating bookings:', error.message);
        } else {
            console.log('✅ Bookings migrated successfully\n');
        }
    }

    // 4. Migrate public holidays
    if (data.publicHolidays && data.publicHolidays.length > 0) {
        console.log(`🎉 Migrating ${data.publicHolidays.length} public holidays...`);
        const holidays = data.publicHolidays.map(h => ({
            date: h.date,
            name: h.name
        }));
        
        const { error } = await supabase.from('public_holidays').upsert(holidays, { onConflict: 'date' });
        if (error) {
            console.error('❌ Error migrating holidays:', error.message);
        } else {
            console.log('✅ Public holidays migrated successfully\n');
        }
    }

    // 5. Migrate desks
    if (data.desks && data.desks.length > 0) {
        console.log(`🪑 Migrating ${data.desks.length} desks...`);
        const desks = data.desks.map(d => ({
            id: d.id,
            name: d.name,
            location_id: d.locationId,
            floor: d.floor || '1',
            zone: d.zone || '',
            x: d.x || 0,
            y: d.y || 0,
            width: d.width || 60,
            height: d.height || 40,
            desk_type: d.deskType || 'hotseat',
            assigned_team_id: d.assignedTeamId || null,
            chair_positions: d.chairPositions || ['bottom'],
            qr_code: d.qrCode,
            created_at: d.createdAt || new Date().toISOString()
        }));
        
        const { error } = await supabase.from('desks').upsert(desks);
        if (error) {
            console.error('❌ Error migrating desks:', error.message);
        } else {
            console.log('✅ Desks migrated successfully\n');
        }
    }

    // 6. Migrate desk bookings
    if (data.deskBookings && data.deskBookings.length > 0) {
        console.log(`📝 Migrating ${data.deskBookings.length} desk bookings...`);
        const deskBookings = data.deskBookings.map(b => ({
            id: b.id,
            desk_id: b.deskId,
            desk_name: b.deskName,
            location_id: b.locationId,
            date: b.date,
            start_time: b.startTime,
            end_time: b.endTime,
            employee_name: b.employeeName,
            employee_email: b.employeeEmail || '',
            team_id: b.teamId || null,
            checked_in: b.checkedIn || false,
            checked_in_at: b.checkedInAt || null,
            created_at: b.createdAt || new Date().toISOString()
        }));
        
        // Insert in batches of 100 to avoid timeouts
        const batchSize = 100;
        for (let i = 0; i < deskBookings.length; i += batchSize) {
            const batch = deskBookings.slice(i, i + batchSize);
            const { error } = await supabase.from('desk_bookings').upsert(batch);
            if (error) {
                console.error(`❌ Error migrating desk bookings batch ${i / batchSize + 1}:`, error.message);
            }
        }
        console.log('✅ Desk bookings migrated successfully\n');
    }

    // 7. Migrate floor elements
    if (data.floorElements && data.floorElements.length > 0) {
        console.log(`🏗️ Migrating ${data.floorElements.length} floor elements...`);
        const floorElements = data.floorElements.map(e => ({
            id: e.id,
            type: e.type,
            location_id: e.locationId,
            floor: e.floor || '1',
            x: e.x || 0,
            y: e.y || 0,
            width: e.width || 100,
            height: e.height || 100,
            points: e.points || [],
            label: e.label || '',
            color: e.color || null,
            created_at: e.createdAt || new Date().toISOString()
        }));
        
        const { error } = await supabase.from('floor_elements').upsert(floorElements);
        if (error) {
            console.error('❌ Error migrating floor elements:', error.message);
        } else {
            console.log('✅ Floor elements migrated successfully\n');
        }
    }

    console.log('🎉 Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Set SUPABASE_URL and SUPABASE_ANON_KEY in your server environment');
    console.log('2. Start your server with: npm start');
}

migrate().catch(console.error);

