const { OmniPulse } = require('../dist/index');

// Mock backend server for testing
const http = require('http');

const server = http.createServer((req, res) => {
    let body = [];
    req.on('data', (chunk) => {
        body.push(chunk);
    }).on('end', () => {
        body = Buffer.concat(body).toString();
        console.log(`[Backend Mock] Received ${req.method} ${req.url}`);
        // console.log('Payload:', body); // Compressed, so printing as string might be garbage
        res.writeHead(200);
        res.end('OK');
    });
});

server.listen(4000, () => {
    console.log('[Backend Mock] Listening on port 4000');

    // Initialize SDK
    OmniPulse.init({
        apiKey: 'test-key',
        serviceName: 'test-node-service',
        environment: 'development',
        endpoint: 'http://localhost:4000',
        debug: true
    });

    console.log('[Test] Sending logs...');
    OmniPulse.logger.info('Hello World from Node SDK!');
    OmniPulse.logger.error('Something went wrong', { error_code: 500 });

    console.log('[Test] Starting trace...');
    OmniPulse.tracer.trace('process_request', (span) => {
        span.attributes['http.method'] = 'GET';

        // Nested span
        OmniPulse.tracer.trace('db_query', (childSpan) => {
            childSpan.attributes['db.statement'] = 'SELECT * FROM users';
            // Simulate work
            const start = Date.now();
            while (Date.now() - start < 100) { }
        });
    });

    // Wait for flush (default 5s, but we can't force flush easily from outside without exposing methods)
    // We'll rely on interval.

    setTimeout(() => {
        console.log('[Test] Finished waiting. Closing...');
        server.close();
        process.exit(0);
    }, 6000);
});
