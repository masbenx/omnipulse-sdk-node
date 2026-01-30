# @omnipulse/node - Official Node.js SDK

The official Node.js SDK for [OmniPulse](https://omnipulse.cloud) - a unified monitoring platform for Server Monitoring, APM, and Centralized Logs.

## Installation

```bash
npm install @omnipulse/node
```

## Quick Start

```javascript
const { OmniPulse } = require('@omnipulse/node');

// Initialize SDK
OmniPulse.init({
    apiKey: 'YOUR_X_INGEST_KEY',
    serviceName: 'my-node-app',
    endpoint: 'https://api.omnipulse.cloud' // Your OmniPulse backend URL
});

// Logging
OmniPulse.logger.info('Application started');
OmniPulse.logger.error('Something went wrong', { userId: 123 });

// Tracing
OmniPulse.tracer.trace('processOrder', (span) => {
    span.attributes = { orderId: 'ORD-001' };
    // Your business logic here
});
```

## Framework Integrations

### Express

```javascript
const express = require('express');
const { OmniPulse, expressMiddleware } = require('@omnipulse/node');

OmniPulse.init({ /* config */ });

const app = express();
app.use(expressMiddleware()); // Automatic request tracing

app.get('/hello', (req, res) => {
    res.send('Hello World');
});

app.listen(3000);
```

### Fastify

```javascript
const fastify = require('fastify')();
const { OmniPulse, fastifyPlugin } = require('@omnipulse/node');

OmniPulse.init({ /* config */ });

fastify.register(fastifyPlugin); // Automatic request tracing

fastify.get('/hello', async () => {
    return { hello: 'world' };
});

fastify.listen({ port: 3000 });
```

## Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiKey` | string | Yes | Your `X-Ingest-Key` from OmniPulse |
| `serviceName` | string | Yes | Name of your application |
| `endpoint` | string | Yes | OmniPulse backend URL |
| `debug` | boolean | No | Enable debug logging |

## License

MIT
