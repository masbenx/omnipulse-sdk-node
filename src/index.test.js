const { OmniPulseClient } = require('../dist/client');
const { Logger } = require('../dist/logger');
const { Tracer } = require('../dist/tracer');
const { Transport } = require('../dist/transport');

// Helper to reset the singleton
function resetSingleton() {
    OmniPulseClient.instance = undefined;
}

// ===========================================================
// OmniPulseClient Tests
// ===========================================================
describe('OmniPulseClient', () => {
    afterEach(() => resetSingleton());

    it('should return singleton instance', () => {
        const a = OmniPulseClient.getInstance();
        const b = OmniPulseClient.getInstance();
        expect(a).toBe(b);
    });

    it('should return version string', () => {
        const client = OmniPulseClient.getInstance();
        expect(client.version()).toMatch(/^v\d+\.\d+\.\d+$/);
    });

    it('should have logger and tracer before init (no crash)', () => {
        const client = OmniPulseClient.getInstance();
        expect(client.logger).toBeDefined();
        expect(client.tracer).toBeDefined();
        expect(() => client.logger.info('test before init')).not.toThrow();
    });

    it('should return empty config before init', () => {
        const client = OmniPulseClient.getInstance();
        expect(client.getConfig()).toEqual({});
    });

    it('should redact apiKey in getConfig', () => {
        const client = OmniPulseClient.getInstance();
        client.init({ apiKey: 'my-secret-key-123', serviceName: 'test-app', endpoint: 'http://localhost:8080' });
        const cfg = client.getConfig();
        expect(cfg.apiKey).toBe('[REDACTED]');
        expect(cfg.serviceName).toBe('test-app');
        expect(cfg.endpoint).toBe('http://localhost:8080');
    });

    it('should warn on double init', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        const client = OmniPulseClient.getInstance();
        client.init({ apiKey: 'key1' });
        client.init({ apiKey: 'key2' });
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already initialized'));
        warnSpy.mockRestore();
    });

    it('should return failure on test() without init', async () => {
        const client = OmniPulseClient.getInstance();
        const result = await client.test();
        expect(result.success).toBe(false);
        expect(result.message).toContain('not initialized');
    });
});

// ===========================================================
// Logger Tests
// ===========================================================
describe('Logger', () => {
    let mockTransport;
    let logger;

    beforeEach(() => {
        mockTransport = { addLog: jest.fn() };
        logger = new Logger(mockTransport);
    });

    it('should log info level', () => {
        logger.info('hello world');
        expect(mockTransport.addLog).toHaveBeenCalledTimes(1);
        const entry = mockTransport.addLog.mock.calls[0][0];
        expect(entry.level).toBe('info');
        expect(entry.message).toBe('hello world');
        expect(entry.timestamp).toBeDefined();
    });

    it('should log warn level', () => {
        logger.warn('warning msg');
        expect(mockTransport.addLog.mock.calls[0][0].level).toBe('warn');
    });

    it('should log error level', () => {
        logger.error('error msg');
        expect(mockTransport.addLog.mock.calls[0][0].level).toBe('error');
    });

    it('should log debug level', () => {
        logger.debug('debug msg');
        expect(mockTransport.addLog.mock.calls[0][0].level).toBe('debug');
    });

    it('should include meta', () => {
        logger.info('with attrs', { foo: 'bar', count: 42 });
        expect(mockTransport.addLog.mock.calls[0][0].meta).toEqual({ foo: 'bar', count: 42 });
    });

    it('should handle undefined meta', () => {
        logger.info('no attrs');
        expect(mockTransport.addLog.mock.calls[0][0].meta).toBeUndefined();
    });

    it('should generate valid ISO timestamp', () => {
        logger.info('test');
        const ts = mockTransport.addLog.mock.calls[0][0].timestamp;
        expect(new Date(ts).getTime()).not.toBeNaN();
    });
});

// ===========================================================
// Tracer Tests
// ===========================================================
describe('Tracer', () => {
    let mockTransport;
    let tracer;

    beforeEach(() => {
        mockTransport = { addSpan: jest.fn() };
        tracer = new Tracer(mockTransport);
    });

    it('should create a span with name and context', () => {
        const span = tracer.startSpan('test-operation');
        expect(span.name).toBe('test-operation');
        expect(span.context.traceId).toBeDefined();
        expect(span.context.spanId).toBeDefined();
    });

    it('should generate unique span IDs', () => {
        const s1 = tracer.startSpan('op1');
        const s2 = tracer.startSpan('op2');
        expect(s1.context.spanId).not.toBe(s2.context.spanId);
    });

    it('should propagate traceId from parent', () => {
        const parent = tracer.startSpan('parent');
        const child = tracer.startSpan('child', parent.context);
        expect(child.context.traceId).toBe(parent.context.traceId);
        expect(child.context.spanId).not.toBe(parent.context.spanId);
    });

    it('should end span and send to transport', () => {
        const span = tracer.startSpan('test');
        tracer.endSpan(span);
        expect(mockTransport.addSpan).toHaveBeenCalledTimes(1);
        const exported = mockTransport.addSpan.mock.calls[0][0];
        expect(exported.name).toBe('test');
        expect(exported.trace_id).toBe(span.context.traceId);
        expect(exported.status_code).toBe('ok');
    });

    it('should wrap sync function with trace()', () => {
        const result = tracer.trace('my-op', () => 42);
        expect(result).toBe(42);
        expect(mockTransport.addSpan).toHaveBeenCalledTimes(1);
    });

    it('should capture errors in trace()', () => {
        expect(() => {
            tracer.trace('fail', () => { throw new Error('boom'); });
        }).toThrow('boom');
        const exported = mockTransport.addSpan.mock.calls[0][0];
        expect(exported.status_code).toBe('error');
    });
});

// ===========================================================
// Transport Tests
// ===========================================================
describe('Transport', () => {
    let transport;

    beforeEach(() => {
        jest.useFakeTimers();
        transport = new Transport({ apiKey: 'test-key', serviceName: 'test-svc', endpoint: 'http://localhost:9999' });
    });

    afterEach(() => {
        transport.stop();
        jest.useRealTimers();
    });

    it('should queue log entries without error', () => {
        expect(() => transport.addLog({ level: 'info', message: 'test', timestamp: new Date().toISOString() })).not.toThrow();
    });

    it('should queue span entries without error', () => {
        expect(() => transport.addSpan({ name: 'span', trace_id: 'a', span_id: 'b' })).not.toThrow();
    });

    it('should queue job entries without error', () => {
        expect(() => transport.addJob({ job_name: 'job1', duration_ms: 50, wait_time_ms: 5, status: 'succeeded' })).not.toThrow();
    });

    it('should not crash on empty flush', async () => {
        await expect(transport.flushLogs()).resolves.not.toThrow();
        await expect(transport.flushTraces()).resolves.not.toThrow();
        await expect(transport.flushJobs()).resolves.not.toThrow();
    });

    it('should stop cleanly', () => {
        expect(() => transport.stop()).not.toThrow();
    });
});

// ===========================================================
// Fail-Safe Tests
// ===========================================================
describe('Fail-Safe Behavior', () => {
    afterEach(() => resetSingleton());

    it('should not crash when logging before init', () => {
        const client = OmniPulseClient.getInstance();
        expect(() => client.logger.info('before init')).not.toThrow();
        expect(() => client.logger.error('error before init')).not.toThrow();
    });

    it('should not crash when logJob before init', () => {
        const client = OmniPulseClient.getInstance();
        expect(() => client.logJob({ job_name: 'test', duration_ms: 100, wait_time_ms: 0, status: 'succeeded' })).not.toThrow();
    });

    it('should not crash version() before init', () => {
        const client = OmniPulseClient.getInstance();
        expect(() => client.version()).not.toThrow();
    });
});
