import { Logger } from '@nestjs/common';
import { ZigbeeBridge } from './zigbee-bridge';
import { ZigbeeBridgeHealth } from 'zigbee/interfaces';

describe('ZigbeeBridge', () => {
    const getHealth = (): ZigbeeBridgeHealth | null => (ZigbeeBridge as unknown as { health: ZigbeeBridgeHealth | null }).health;

    const makeHealth = (overrides: Partial<ZigbeeBridgeHealth> = {}): ZigbeeBridgeHealth => ({
        response_time: 5,
        os: { load_average: [0.1, 0.2, 0.3], memory_used_mb: 100, memory_percent: 10 },
        process: { uptime_sec: 1000, memory_used_mb: 50, memory_percent: 5 },
        mqtt: { connected: true, queued: 0, published: 10, received: 10 },
        devices: {},
        ...overrides,
    });

    beforeEach(() => {
        // Silence the internal warnings/debug logs and reset the static state between tests.
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
        jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
        ZigbeeBridge.save(null as unknown as ZigbeeBridgeHealth);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('save', () => {
        it('should store the latest health report', () => {
            const health = makeHealth();

            ZigbeeBridge.save(health);

            expect(getHealth()).toEqual(health);
        });

        it('should normalize a missing report to null', () => {
            ZigbeeBridge.save(undefined as unknown as ZigbeeBridgeHealth);

            expect(getHealth()).toBeNull();
        });
    });

    describe('connected', () => {
        it('should return true when a health report shows the MQTT broker connected', () => {
            ZigbeeBridge.save(makeHealth({ mqtt: { connected: true, queued: 0, published: 1, received: 1 } }));

            expect(ZigbeeBridge.connected()).toBe(true);
        });

        it('should return false and warn when no health report has been received', () => {
            const warnSpy = jest.spyOn(Logger.prototype, 'warn');

            expect(ZigbeeBridge.connected()).toBe(false);
            expect(warnSpy).toHaveBeenCalled();
        });

        it('should return false when the MQTT broker is not connected', () => {
            ZigbeeBridge.save(makeHealth({ mqtt: { connected: false, queued: 0, published: 0, received: 0 } }));

            expect(ZigbeeBridge.connected()).toBe(false);
        });
    });
});
