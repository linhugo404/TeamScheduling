const express = require('express');
const path = require('path');
const router = express.Router();

/**
 * Auth callback route - serve index.html for SPA auth redirect
 */
router.get('/callback', (req, res) => {
    res.sendFile('index.html', { root: path.join(__dirname, '../public') });
});

/**
 * Auth config endpoint - serves Azure AD config to frontend
 */
router.get('/config', (req, res) => {
    const clientId = process.env.AZURE_AD_CLIENT_ID;
    const tenantId = process.env.AZURE_AD_TENANT_ID;
    
    if (!clientId || !tenantId) {
        return res.status(503).json({ 
            error: 'Azure AD not configured',
            configured: false 
        });
    }
    
    // Determine protocol - trust proxy headers in production (Render, Heroku, etc.)
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    
    // Force HTTPS in production (non-localhost)
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    const finalProtocol = isLocalhost ? protocol : 'https';
    
    res.json({
        configured: true,
        clientId: clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: `${finalProtocol}://${host}/auth/callback`
    });
});

module.exports = router;

