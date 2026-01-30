const fastify = require('fastify')({ logger: false });
const { OmniPulse, fastifyPlugin } = require('../dist/index');
const http = require('http');

// Mock Backend
const backend = http.createServer((req, res) => {
    let body = [];
    req.on('data', c => body.push(c));
    req.on('end', () => {
        console.log(`[Backend] Received ${req.method} ${req.url}`);
        res.end('OK');
    });
});
backend.listen(4002);

// Initialize SDK
OmniPulse.init({
    apiKey: 'test-fastify',
    serviceName: 'fastify-service',
    endpoint: 'http://localhost:4002',
    debug: true
});

// Register Plugin
fastify.register(fastifyPlugin);

fastify.get('/hello', async (request, reply) => {
    // Check span
    const span = OmniPulse.tracer.getCurrentContext();
    console.log('Current Span Context:', span);
    return { hello: 'world' };
});

const start = async () => {
    try {
        await fastify.listen({ port: 3001 });
        console.log('Fastify listening on 3001');

        // Trigger Request
        http.get('http://localhost:3001/hello', (res) => {
            res.on('data', () => { });
            res.on('end', () => {
                console.log('Request complete');
                setTimeout(() => {
                    fastify.close();
                    backend.close();
                    process.exit(0);
                }, 5500); // Wait for flush
            });
        });

    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
