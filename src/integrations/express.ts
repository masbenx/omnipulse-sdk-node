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
        
        req.__omnipulse_start = Date.now();

        let parentContext: any;
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
                
                const spanStart = Array.isArray(span.startTime) ? (span.startTime[0] * 1000 + span.startTime[1] / 1e6) : Date.now();
                const durationMs = Date.now() - (req.__omnipulse_start || spanStart);
                
                OmniPulse.logRequest({
                    timestamp: new Date().toISOString(),
                    method: method,
                    route: url,
                    status: res.statusCode,
                    duration_ms: durationMs,
                    trace_id: parentContext?.traceId
                });
            });

            // Continue chain
            next();
        });
    };
};
