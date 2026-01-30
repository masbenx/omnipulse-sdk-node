import { Logger } from './logger';
import { Tracer } from './tracer';
import { Transport } from './transport';
import { OmniPulseConfig } from './types';

export class OmniPulseClient {
    private static instance: OmniPulseClient;
    private transport?: Transport;
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

        this.transport = new Transport(config);
        this.logger = new Logger(this.transport);
        this.tracer = new Tracer(this.transport);

        if (config.debug) {
            console.log('[OmniPulse] SDK Initialized', config);
        }
    }
}

export const OmniPulse = OmniPulseClient.getInstance();
