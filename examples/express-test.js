const express = require('express'); // Assume express is installed or mock it
const { OmniPulse, expressMiddleware } = require('../dist/index');
const http = require('http');

// Mock Express if not available (since we don't want to install it as devDependency if not needed)
// But for this test to be useful we assume the user environment has it or we simulate it.
// Let's simluate a minimal express app structure if require fails.

let app;
try {
    app = express();
} catch (e) {
    console.log('Express not found, mocking minimal express app');
    const handlers = [];
    app = {
        use: (fn) => handlers.push(fn),
        get: (path, fn) => handlers.push((req, res, next) => {
            if (req.url === path && req.method === 'GET') fn(req, res, next);
            else next();
        }),
        listen: (port, cb) => {
            const server = http.createServer((req, res) => {
                req.path = req.url;
                let idx = 0;
                const next = (err) => {
                    if (idx < handlers.length) {
                        const fn = handlers[idx++];
                        fn(req, res, next);
                    }
                };
                next();
            });
            server.listen(port, cb);
            return server;
        }
    };
}

// Mock Backend
const backend = http.createServer((req, res) => {
    let body = [];
    req.on('data', c => body.push(c));
    req.on('end', () => {
        console.log(`[Backend] Received ${req.method} ${req.url}`);
        res.end('OK');
    });
});
backend.listen(4001);

// Initialize SDK
OmniPulse.init({
    apiKey: 'test-express',
    serviceName: 'express-service',
    endpoint: 'http://localhost:4001',
    debug: true
});

// Use Middleware
app.use(expressMiddleware());

app.get('/hello', (req, res) => {
    // Check if we are in a span
    const span = OmniPulse.tracer.getCurrentContext();
    console.log('Current Span Context:', span);

    // Simulate work
    setTimeout(() => {
        res.statusCode = 200;
        res.end('Hello World');
    }, 50);
});

const server = app.listen(3000, () => {
    console.log('App listening on 3000');

    // Trigger Request
    http.get('http://localhost:3000/hello', (res) => {
        res.on('data', () => { });
        res.on('end', () => {
            console.log('Request complete');
            setTimeout(() => {
                server.close();
                backend.close();
                process.exit(0);
            }, 5500); // Wait for flush
        });
    });
});
