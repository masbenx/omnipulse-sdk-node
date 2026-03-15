import * as inspector from 'inspector';
import * as os from 'os';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { OmniPulseConfig } from './types';

export class Profiler {
    private config: OmniPulseConfig;
    private session: inspector.Session | null = null;
    private interval: NodeJS.Timeout | null = null;
    private readonly DURATION_SECS = 60;
    private isProfiling = false;

    constructor(config: OmniPulseConfig) {
        this.config = config;
    }

    public start() {
        if (!this.config.enableProfiling) return;
        if (this.session) return;

        try {
            this.session = new inspector.Session();
            this.session.connect();
        } catch (e) {
            if (this.config.debug) {
                console.error('[OmniPulse Profiler] Failed to connect inspector session', e);
            }
            return;
        }

        this.runCycle();
        this.interval = setInterval(() => {
            this.runCycle();
        }, this.DURATION_SECS * 1000);
    }

    private runCycle() {
        if (!this.session) return;

        if (this.isProfiling) {
            // Stop current profile and send
            this.session.post('Profiler.stop', (err, res) => {
                this.isProfiling = false;
                if (!err && res && res.profile) {
                    this.sendProfile(JSON.stringify(res.profile));
                }
                // Start next
                this.startProfileSession();
            });
        } else {
            // First time start
            this.session.post('Profiler.enable', () => {
                this.startProfileSession();
            });
        }
    }

    private startProfileSession() {
        if (!this.session) return;
        this.session.post('Profiler.start', (err) => {
            if (!err) {
                this.isProfiling = true;
            } else if (this.config.debug) {
                console.error('[OmniPulse Profiler] failed to start CPU profile', err);
            }
        });
    }

    private sendProfile(profileJson: string) {
        const endpoint = this.config.endpoint || 'https://api.omnipulse.cloud';
        const url = new URL('/api/ingest/app-profiles', endpoint);
        const isHttps = url.protocol === 'https:';
        const client = isHttps ? https : http;

        const boundary = '----OmniPulseProfileBoundary' + Date.now().toString(16);
        const instanceHash = `${os.hostname()}-${process.pid}`;
        const env = this.config.environment || 'production';

        const payloadParts = [
            `--${boundary}\r\nContent-Disposition: form-data; name="instance_hash"\r\n\r\n${instanceHash}\r\n`,
            `--${boundary}\r\nContent-Disposition: form-data; name="env"\r\n\r\n${env}\r\n`,
            `--${boundary}\r\nContent-Disposition: form-data; name="profile_type"\r\n\r\ncpu\r\n`,
            `--${boundary}\r\nContent-Disposition: form-data; name="duration_seconds"\r\n\r\n${this.DURATION_SECS}\r\n`,
            `--${boundary}\r\nContent-Disposition: form-data; name="profile"; filename="cpu.cpuprofile"\r\nContent-Type: application/json\r\n\r\n${profileJson}\r\n`,
            `--${boundary}--\r\n`
        ];

        const payload = payloadParts.join('');

        const options: http.RequestOptions = {
            method: 'POST',
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': Buffer.byteLength(payload),
                'X-Ingest-Key': this.config.apiKey,
                'User-Agent': 'omnipulse-node-sdk/v0.1.3'
            },
            timeout: 10000
        };

        const req = client.request(options, (res) => {
            res.resume(); // consume
            if (this.config.debug && res.statusCode && res.statusCode >= 400) {
                console.error(`[OmniPulse Profiler] backend rejected profile (status ${res.statusCode})`);
            }
        });

        req.on('error', (e) => {
            if (this.config.debug) console.error('[OmniPulse Profiler] send error', e);
        });

        // Use Buffer to handle correct byte lengths without encoding issues
        req.write(Buffer.from(payload, 'utf8'));
        req.end();
    }

    public stop() {
        if (this.interval) clearInterval(this.interval);
        if (this.session) {
            if (this.isProfiling) {
                this.session.post('Profiler.stop');
            }
            this.session.post('Profiler.disable');
            this.session.disconnect();
            this.session = null;
        }
    }
}
