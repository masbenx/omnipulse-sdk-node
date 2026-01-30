import * as http from 'http';
import * as https from 'https';
import * as zlib from 'zlib';
import { URL } from 'url';
import { LogEntry, OmniPulseConfig } from './types';

export class Transport {
    private config: OmniPulseConfig;
    private logQueue: LogEntry[] = [];
    private spanQueue: any[] = []; // Using any for now, better to use Span interface
    private flushInterval: NodeJS.Timeout | null = null;
    private readonly BATCH_SIZE = 50;
    private readonly FLUSH_MS = 5000;

    constructor(config: OmniPulseConfig) {
        this.config = config;
        this.startBatching();
    }

    private startBatching() {
        if (this.flushInterval) clearInterval(this.flushInterval);
        this.flushInterval = setInterval(() => {
            this.flushLogs();
            this.flushTraces();
        }, this.FLUSH_MS);
    }

    public addLog(entry: LogEntry) {
        this.logQueue.push(entry);
        if (this.logQueue.length >= this.BATCH_SIZE) {
            this.flushLogs();
        }
    }

    public addSpan(span: any) {
        this.spanQueue.push(span);
        if (this.spanQueue.length >= this.BATCH_SIZE) {
            this.flushTraces();
        }
    }

    public async flushLogs() {
        if (this.logQueue.length === 0) return;

        const batch = [...this.logQueue];
        this.logQueue = []; // Clear queue immediately

        try {
            await this.send('/api/ingest/app-logs', {
                service_name: this.config.serviceName || 'node-app',
                environment: this.config.environment || 'production',
                logs: batch
            });
        } catch (err) {
            if (this.config.debug) {
                console.error('[OmniPulse SDK] Failed to flush logs:', err);
            }
        }
    }

    public async flushTraces() {
        if (this.spanQueue.length === 0) return;

        const batch = [...this.spanQueue];
        this.spanQueue = []; // Clear queue

        try {
            await this.send('/api/ingest/app-traces', {
                service_name: this.config.serviceName || 'node-app',
                environment: this.config.environment || 'production',
                spans: batch
            });
        } catch (err) {
            if (this.config.debug) {
                console.error('[OmniPulse SDK] Failed to flush traces:', err);
            }
        }
    }

    private send(path: string, payload: any): Promise<void> {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify(payload);

            // GZIP Compression
            zlib.gzip(data, (err, buffer) => {
                if (err) {
                    return reject(err);
                }

                const endpoint = this.config.endpoint || 'https://api.omnipulse.cloud';
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
                        'Content-Encoding': 'gzip',
                        'Content-Length': buffer.length,
                        'X-Ingest-Key': this.config.apiKey,
                        'User-Agent': 'omnipulse-node-sdk/v0.1.1'
                    },
                    timeout: 2000 // Short timeout for fire-and-forget
                };

                const req = client.request(options, (res) => {
                    // We consume response data to free memory
                    res.resume();

                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve();
                    } else {
                        reject(new Error(`OmniPulse backend returned status ${res.statusCode}`));
                    }
                });

                req.on('error', (e) => {
                    reject(e);
                });

                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Request timed out'));
                });

                req.write(buffer);
                req.end();
            });
        });
    }

    public stop() {
        if (this.flushInterval) clearInterval(this.flushInterval);
        // Attempt final flush
        this.flushLogs();
    }
}
