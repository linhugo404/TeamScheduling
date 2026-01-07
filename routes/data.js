const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { toCamelCase } = require('../utils/helpers');

/**
 * Get all data (locations, teams, bookings, holidays, desks, etc.)
 * Used for initial app load
 */
router.get('/', async (req, res) => {
    try {
        const [
            { data: locations, error: locError },
            { data: teams, error: teamError },
            { data: bookings, error: bookError },
            { data: publicHolidays, error: holidayError },
            { data: desks, error: deskError },
            { data: deskBookings, error: deskBookError },
            { data: floorElements, error: floorError }
        ] = await Promise.all([
            supabase.from('locations').select('*'),
            supabase.from('teams').select('*'),
            supabase.from('bookings').select('*'),
            supabase.from('public_holidays').select('*'),
            supabase.from('desks').select('*'),
            supabase.from('desk_bookings').select('*'),
            supabase.from('floor_elements').select('*')
        ]);

        if (locError || teamError || bookError || holidayError || deskError || deskBookError || floorError) {
            throw new Error('Failed to fetch data');
        }

        res.json({
            locations: toCamelCase(locations),
            teams: toCamelCase(teams),
            bookings: toCamelCase(bookings),
            publicHolidays: toCamelCase(publicHolidays),
            desks: toCamelCase(desks),
            deskBookings: toCamelCase(deskBookings),
            floorElements: toCamelCase(floorElements)
        });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Failed to read data' });
    }
});

module.exports = router;

