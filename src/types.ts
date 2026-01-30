export interface OmniPulseConfig {
    /**
     * The Ingest Key for the project/app.
     * Required for authentication.
     */
    apiKey: string;

    /**
     * The Service Name to identify this application.
     * Defaults to "node-app".
     */
    serviceName?: string;

    /**
     * The environment (e.g., 'production', 'staging').
     * Defaults to 'production'.
     */
    environment?: string;

    /**
     * The endpoint URL of the OmniPulse backend.
     * Defaults to "https://api.omnipulse.cloud".
     */
    endpoint?: string;

    /**
     * Helper to enable/disable console debugging of the SDK itself.
     */
    debug?: boolean;
}

export interface LogEntry {
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    timestamp: string; // ISO string using microsecond/nanosecond if possible
    attributes?: Record<string, any>;
    trace_id?: string;
    span_id?: string;
}

export interface SpanContext {
    traceId: string;
    spanId: string;
}

export interface Span {
    name: string;
    context: SpanContext;
    startTime: [number, number]; // hrtime
    endTime?: [number, number]; // hrtime
    status?: {
        code: 'ok' | 'error';
        message?: string;
    };
    attributes?: Record<string, any>;
    events?: SpanEvent[];
}

export interface SpanEvent {
    name: string;
    timestamp: string;
    attributes?: Record<string, any>;
}
