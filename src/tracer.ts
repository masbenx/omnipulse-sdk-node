import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { Transport } from './transport';
import { Span, SpanContext } from './types';

export class Tracer {
    private transport: Transport;
    private asyncLocalStorage: AsyncLocalStorage<SpanContext>;

    constructor(transport: Transport) {
        this.transport = transport;
        this.asyncLocalStorage = new AsyncLocalStorage<SpanContext>();
    }

    /**
     * Start a new span.
     * Use runWithSpan to execute code within this span's context.
     */
    public startSpan(name: string, parentContext?: SpanContext): Span {
        const parent = parentContext || this.getCurrentContext();

        const span: Span = {
            name,
            context: {
                traceId: parent?.traceId || randomUUID(),
                spanId: randomUUID()
            },
            startTime: process.hrtime(),
            attributes: {}
        };

        // If parent exists, logic to link them (parent_span_id) is needed in Span interface
        // But for MVP we just propagate traceId

        return span;
    }

    public endSpan(span: Span) {
        span.endTime = process.hrtime();
        // Calculate duration and format for transport
        // Send to transport
        this.transport.addSpan(this.formatSpanForExport(span));
    }

    /**
     * Wraps a callback function in a new span.
     */
    public trace<T>(name: string, callback: (span: Span) => T): T {
        const span = this.startSpan(name);

        return this.asyncLocalStorage.run(span.context, () => {
            try {
                const result = callback(span);
                if (result instanceof Promise) {
                    return result.finally(() => this.endSpan(span)) as unknown as T;
                }
                this.endSpan(span);
                return result;
            } catch (err) {
                span.status = { code: 'error', message: String(err) };
                this.endSpan(span);
                throw err;
            }
        });
    }

    public getCurrentContext(): SpanContext | undefined {
        return this.asyncLocalStorage.getStore();
    }

    // Helper to convert internal Span to backend format
    private formatSpanForExport(span: Span) {
        const [startSec, startNano] = span.startTime;
        const [endSec, endNano] = span.endTime || process.hrtime();

        const startTime = new Date(startSec * 1000 + startNano / 1e6).toISOString();
        const endTime = new Date(endSec * 1000 + endNano / 1e6).toISOString();
        const durationNanos = (endSec - startSec) * 1e9 + (endNano - startNano);

        return {
            trace_id: span.context.traceId,
            span_id: span.context.spanId,
            name: span.name,
            start_time: startTime,
            end_time: endTime,
            duration_nanos: durationNanos,
            status_code: span.status?.code || 'ok',
            status_message: span.status?.message || '',
            attributes: span.attributes || {}
        };
    }
}
