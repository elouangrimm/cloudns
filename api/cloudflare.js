// Vercel Serverless Function - Cloudflare API Proxy

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Cloudflare-API-Key, X-Zone-ID');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Extract Cloudflare credentials from headers
    const apiKey = req.headers['x-cloudflare-api-key'];
    const zoneId = req.headers['x-zone-id'];
    
    if (!apiKey) {
        return res.status(400).json({ 
            success: false, 
            errors: [{ message: 'Missing X-Cloudflare-API-Key header' }] 
        });
    }

    // Get the path from query parameter
    const { path = '' } = req.query;
    
    if (!path) {
        return res.status(400).json({ 
            success: false, 
            errors: [{ message: 'Missing path query parameter' }] 
        });
    }

    try {
        // Build the full Cloudflare API URL
        const cloudflareUrl = `${CLOUDFLARE_API_BASE}${path}`;
        
        // Prepare fetch options
        const fetchOptions = {
            method: req.method,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        };

        // Add body for POST/PUT/PATCH requests
        if (req.body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
            fetchOptions.body = JSON.stringify(req.body);
        }

        // Make request to Cloudflare
        const response = await fetch(cloudflareUrl, fetchOptions);
        const data = await response.json();

        // Return Cloudflare's response
        res.status(response.status).json(data);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ 
            success: false, 
            errors: [{ message: error.message || 'Proxy request failed' }] 
        });
    }
}
