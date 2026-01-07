const express = require('express');
const https = require('https');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { toCamelCase } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * Fetch public holidays from Nager.Date API
 */
router.get('/fetch/:year', async (req, res) => {
    try {
        const { year } = req.params;
        const country = req.query.country || 'ZA';
        
        const fetchHolidays = () => {
            return new Promise((resolve, reject) => {
                https.get(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`, (response) => {
                    let data = '';
                    response.on('data', chunk => data += chunk);
                    response.on('end', () => {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(new Error('Failed to parse holiday data'));
                        }
                    });
                }).on('error', reject);
            });
        };
        
        const holidays = await fetchHolidays();
        
        const formattedHolidays = holidays.map(h => ({
            date: h.date,
            name: h.localName || h.name
        }));
        
        res.json(formattedHolidays);
    } catch (error) {
        logger.error('Error fetching holidays:', error);
        res.status(500).json({ error: 'Failed to fetch holidays from API' });
    }
});

/**
 * Update holidays in the database
 */
router.post('/', async (req, res) => {
    try {
        const { holidays } = req.body;
        
        // Upsert holidays (insert or update on conflict)
        const { error } = await supabase
            .from('public_holidays')
            .upsert(holidays.map(h => ({ date: h.date, name: h.name })), { onConflict: 'date' });
        
        if (error) throw error;
        
        const { data: allHolidays } = await supabase
            .from('public_holidays')
            .select('*')
            .order('date');
        
        res.json(toCamelCase(allHolidays));
    } catch (error) {
        logger.error('Error updating holidays:', error);
        res.status(500).json({ error: 'Failed to update holidays' });
    }
});

/**
 * Delete a holiday
 */
router.delete('/:date', async (req, res) => {
    try {
        const { date } = req.params;
        
        const { error } = await supabase
            .from('public_holidays')
            .delete()
            .eq('date', date);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        logger.error('Error deleting holiday:', error);
        res.status(500).json({ error: 'Failed to delete holiday' });
    }
});

module.exports = router;

