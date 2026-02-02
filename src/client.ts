import { Logger } from './logger';
import { Tracer } from './tracer';
import { Transport } from './transport';
import { OmniPulseConfig } from './types';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

export interface TestResult {
    success: boolean;
    message: string;
    httpCode?: number;
    response?: any;
}

export class OmniPulseClient {
    private static instance: OmniPulseClient;
    private transport?: Transport;
    private config?: OmniPulseConfig;
    public logger: Logger;
    public tracer: Tracer;

    private constructor() {
        // Uninitialized state
        // Dummy logger/tracer to prevent crash if used before init
        this.logger = new Logger({ addLog: () => { } } as any);
        this.tracer = new Tracer({ addSpan: () => { } } as any);
    }

    public static getInstance(): OmniPulseClient {
        if (!OmniPulseClient.instance) {
            OmniPulseClient.instance = new OmniPulseClient();
        }
        return OmniPulseClient.instance;
    }

    public init(config: OmniPulseConfig) {
        if (this.transport) {
            console.warn('[OmniPulse] SDK already initialized');
            return;
        }

        this.config = config;
        this.transport = new Transport(config);
        this.logger = new Logger(this.transport);
        this.tracer = new Tracer(this.transport);

        if (config.debug) {
            console.log('[OmniPulse] SDK Initialized', config);
        }
    }

    /**
     * Test connection to OmniPulse backend
     * Sends a test log entry and verifies the connection
     */
    public async test(): Promise<TestResult> {
        if (!this.config) {
            return {
                success: false,
                message: 'OmniPulse SDK not initialized. Call OmniPulse.init() first.'
            };
        }

        if (!this.config.apiKey) {
            return {
                success: false,
                message: 'No API key configured. Set "apiKey" in config.'
            };
        }

        const endpoint = this.config.endpoint || 'https://api.omnipulse.cloud';
        const path = '/api/ingest/app-logs';

        const payload = JSON.stringify({
            service_name: this.config.serviceName || 'node-app',
            environment: this.config.environment || 'production',
            logs: [{
                level: 'info',
                message: 'OmniPulse SDK test connection successful',
                timestamp: new Date().toISOString(),
                attributes: {
                    sdk: 'node',
                    test: 'true',
                    node_version: process.version
                }
            }]
        });

        return new Promise((resolve) => {
            try {
                const url = new URL(path, endpoint);
                const isHttps = url.protocol === 'https:';
                const client = isHttps ? https : http;

                const options: http.RequestOptions = {
                    method: 'POST',
                    hostname: url.hostname,
                    port: url.port || (isHttps ? 443 : 80),
                    path: url.pathname + url.search,
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(payload),
                        'X-Ingest-Key': this.config!.apiKey,
                        'User-Agent': 'omnipulse-node-sdk/v0.1.1'
                    },
                    timeout: 10000
                };

                const req = client.request(options, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        const statusCode = res.statusCode || 0;
                        if (statusCode >= 200 && statusCode < 300) {
                            resolve({
                                success: true,
                                message: 'Connection successful! Test log sent.',
                                httpCode: statusCode,
                                response: data ? JSON.parse(data) : null
                            });
                        } else {
                            resolve({
                                success: false,
                                message: `Request failed with HTTP ${statusCode}`,
                                httpCode: statusCode,
                                response: data ? JSON.parse(data) : null
                            });
                        }
                    });
                });

                req.on('error', (e) => {
                    resolve({
                        success: false,
                        message: 'Connection failed: ' + e.message
                    });
                });

                req.on('timeout', () => {
                    req.destroy();
                    resolve({
                        success: false,
                        message: 'Connection timed out'
                    });
                });

                req.write(payload);
                req.end();
            } catch (e: any) {
                resolve({
                    success: false,
                    message: 'Exception: ' + e.message
                });
            }
        });
    }

    /**
     * Get SDK version
     */
    public version(): string {
        return 'v0.1.1';
    }

    /**
     * Get current configuration (redacted)
     */
    public getConfig(): Record<string, string> {
        if (!this.config) {
            return {};
        }

        return {
            endpoint: this.config.endpoint ?? 'not set',
            serviceName: this.config.serviceName ?? 'not set',
            apiKey: this.config.apiKey ? '[REDACTED]' : 'not set',
            environment: this.config.environment ?? 'production'
        };
    }
}

export const OmniPulse = OmniPulseClient.getInstance();

