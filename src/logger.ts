import { Transport } from './transport';
import { LogEntry } from './types';

export class Logger {
    private transport: Transport;
    private tracer?: import('./tracer').Tracer;

    constructor(transport: Transport) {
        this.transport = transport;
    }

    public setTracer(tracer: import('./tracer').Tracer) {
        this.tracer = tracer;
    }

    private log(level: LogEntry['level'], message: string, meta?: Record<string, any>) {
        const entry: LogEntry = {
            level,
            message,
            timestamp: new Date().toISOString(),
            meta
        };

        const ctx = this.tracer?.getCurrentContext();
        if (ctx) {
            entry.trace_id = ctx.traceId;
            entry.span_id = ctx.spanId;
        }

        this.transport.addLog(entry);
    }

    public info(message: string, meta?: Record<string, any>) {
        this.log('info', message, meta);
    }

    public warn(message: string, meta?: Record<string, any>) {
        this.log('warn', message, meta);
    }

    public error(message: string, meta?: Record<string, any>) {
        this.log('error', message, meta);
    }

    public debug(message: string, meta?: Record<string, any>) {
        this.log('debug', message, meta);
    }
}
