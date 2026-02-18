import { Transport } from './transport';
import { LogEntry } from './types';

export class Logger {
    private transport: Transport;

    constructor(transport: Transport) {
        this.transport = transport;
    }

    private log(level: LogEntry['level'], message: string, meta?: Record<string, any>) {
        const entry: LogEntry = {
            level,
            message,
            timestamp: new Date().toISOString(),
            meta
        };

        // TODO: Attach TraceContext if inside a Span

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
