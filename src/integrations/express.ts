import { OmniPulse } from '../client';
import { Span } from '../types';

/**
 * Express Middleware for OmniPulse Tracing
 * Usage: app.use(expressMiddleware());
 */
export const expressMiddleware = (options: {
    // Optional config
} = {}) => {
    return (req: any, res: any, next: (err?: any) => void) => {
        const method = req.method;
        const url = req.path || req.url;
        const spanName = `${method} ${url}`;

        let parentContext;
        const traceparent = req.headers['traceparent'];
        if (typeof traceparent === 'string') {
            const parts = traceparent.split('-');
            if (parts.length === 4) {
                parentContext = { traceId: parts[1], spanId: parts[2] };
            }
        }

        OmniPulse.tracer.trace(spanName, (span: Span) => {
            // Add initial attributes
            span.attributes = {
                'http.method': method,
                'http.url': url,
                'http.host': req.headers.host,
                'http.user_agent': req.headers['user-agent'],
            };

            // Hook into response finish to capture status code
            res.on('finish', () => {
                if (span.attributes) {
                    span.attributes['http.status_code'] = res.statusCode;
                }

                if (res.statusCode >= 500) {
                    span.status = { code: 'error', message: `HTTP ${res.statusCode}` };
                }
            });

            // Continue chain
            next();
        });
    };
};
