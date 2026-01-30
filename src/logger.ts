import { Transport } from './transport';
import { LogEntry } from './types';

export class Logger {
    private transport: Transport;

    constructor(transport: Transport) {
        this.transport = transport;
    }

    private log(level: LogEntry['level'], message: string, attributes?: Record<string, any>) {
        const entry: LogEntry = {
            level,
            message,
            timestamp: new Date().toISOString(),
            attributes
        };

        // TODO: Attach TraceContext if inside a Span

        this.transport.addLog(entry);
    }

    public info(message: string, attributes?: Record<string, any>) {
        this.log('info', message, attributes);
    }

    public warn(message: string, attributes?: Record<string, any>) {
        this.log('warn', message, attributes);
    }

    public error(message: string, attributes?: Record<string, any>) {
        this.log('error', message, attributes);
    }

    public debug(message: string, attributes?: Record<string, any>) {
        this.log('debug', message, attributes);
    }
}
