
import dotenv from 'dotenv';
import http from 'http';
import url from 'url';
import { syncExternalData, getTeamPerformanceReport, upsertOfficialSale, getUserStats } from './services/serverService.ts';

dotenv.config();

const PORT = process.env.PORT || 3001;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'admin-secret-123';

const sendJson = (res, status, data) => {
    res.writeHead(status, { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-key' 
    });
    res.end(JSON.stringify(data));
};

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const { pathname, query } = parsedUrl;

    // CORS Preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-admin-key'
        });
        res.end();
        return;
    }

    try {
        // Endpoint: Sync External Data
        if (pathname === '/api/sync' && req.method === 'POST') {
            const key = req.headers['x-admin-key'];
            if (key !== ADMIN_API_KEY) {
                // For demo purposes we might skip auth or warn
                // return sendJson(res, 401, { success: false, error: 'Unauthorized' });
            }
            
            const result = await syncExternalData();
            return sendJson(res, 200, result);
        }

        // Endpoint: Get Leaderboard
        if (pathname === '/api/leaderboard' && req.method === 'GET') {
            const result = await getTeamPerformanceReport();
            return sendJson(res, 200, result);
        }

        // Endpoint: Get Specific User Stats
        if (pathname === '/api/stats' && req.method === 'GET') {
            const userId = query.userId;
            if (!userId) {
                return sendJson(res, 400, { success: false, error: "userId required" });
            }
            const result = await getUserStats(userId);
            return sendJson(res, 200, result);
        }

        // Endpoint: Manually Add Sale (Admin)
        if (pathname === '/api/official_sales' && req.method === 'POST') {
            let body = '';
            for await (const chunk of req) body += chunk;
            const payload = JSON.parse(body);
            
            const result = await upsertOfficialSale(payload);
            return sendJson(res, 200, result);
        }

        // Endpoint: Mock Users (for testing)
        if (pathname === '/api/users' && req.method === 'GET') {
             // In real app, fetch from DB. Mocking for now to avoid crashes if DB empty.
             return sendJson(res, 200, { success: true, data: [] });
        }

        sendJson(res, 404, { error: 'Not Found' });

    } catch (e) {
        console.error(e);
        sendJson(res, 500, { success: false, error: e.message });
    }
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
