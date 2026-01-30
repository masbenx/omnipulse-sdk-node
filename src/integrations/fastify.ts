import { OmniPulse } from '../client';
import { Span } from '../types';

/**
 * Fastify Plugin for OmniPulse Tracing
 * Usage: fastify.register(fastifyPlugin);
 */
export const fastifyPlugin = async (fastify: any, options: any) => {
    // On Request Hook: Start Span
    fastify.addHook('onRequest', (req: any, reply: any, done: () => void) => {
        const method = req.method;
        const url = req.url;
        const spanName = `${method} ${url}`;

        const span = OmniPulse.tracer.startSpan(spanName);

        span.attributes = {
            'http.method': method,
            'http.url': url,
            'http.host': req.headers.host,
            'http.user_agent': req.headers['user-agent'],
        };

        // Attach span to request context
        req.omnipulseSpan = span;

        // Run the rest of the request lifecycle within this span's context
        OmniPulse.tracer.runWithSpan(span, () => {
            done();
        });
    });

    // On Response Hook: End Span
    fastify.addHook('onResponse', (req: any, reply: any, done: () => void) => {
        const span = req.omnipulseSpan;
        if (span) {
            if (span.attributes) {
                span.attributes['http.status_code'] = reply.statusCode;
            }

            if (reply.statusCode >= 500) {
                span.status = { code: 'error', message: `HTTP ${reply.statusCode}` };
            }

            OmniPulse.tracer.endSpan(span);
        }
        done();
    });

    // Error Hook
    fastify.addHook('onError', (req: any, reply: any, error: any, done: () => void) => {
        const span = req.omnipulseSpan;
        if (span) {
            span.status = { code: 'error', message: error.message };
            if (span.attributes) {
                span.attributes['error.name'] = error.name;
                span.attributes['error.stack'] = error.stack;
            }
        }
        done();
    });
};
