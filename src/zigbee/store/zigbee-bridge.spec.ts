import { Logger } from '@nestjs/common';
import { ZigbeeBridge } from './zigbee-bridge';
import { ZigbeeBridgeHealth, ZigbeeBridgeState } from 'zigbee/interfaces';

type ZigbeeBridgeInternals = {
    health: ZigbeeBridgeHealth | null;
    state: ZigbeeBridgeState | null;
    lastHealthAt: number | null;
    lastDeviceMessageAt: number | null;
    healthReportsStale: boolean;
};

describe('ZigbeeBridge', () => {
    const internals = (): ZigbeeBridgeInternals => ZigbeeBridge as unknown as ZigbeeBridgeInternals;

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
        Object.assign(internals(), {
            health: null,
            state: null,
            lastHealthAt: null,
            lastDeviceMessageAt: null,
            healthReportsStale: false,
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    describe('save', () => {
        it('should store the latest health report', () => {
            const health = makeHealth();

            ZigbeeBridge.save(health);

            expect(internals().health).toEqual(health);
        });

        it('should normalize a missing report to null', () => {
            ZigbeeBridge.save(undefined as unknown as ZigbeeBridgeHealth);

            expect(internals().health).toBeNull();
        });

        it('should stamp the report arrival time and clear the stale flag', () => {
            const now = new Date('2026-01-01T12:00:00.000Z').getTime();
            jest.useFakeTimers().setSystemTime(now);
            ZigbeeBridge.markHealthReportsStale(true);

            ZigbeeBridge.save(makeHealth());

            expect(ZigbeeBridge.getLastHealthAt()).toBe(now);
            expect(internals().healthReportsStale).toBe(false);
        });

        it('should keep the previous arrival time when no report is provided', () => {
            ZigbeeBridge.save(makeHealth());
            const lastHealthAt = ZigbeeBridge.getLastHealthAt();

            ZigbeeBridge.save(null as unknown as ZigbeeBridgeHealth);

            expect(ZigbeeBridge.getLastHealthAt()).toBe(lastHealthAt);
        });
    });

    describe('saveState', () => {
        it('should store the reported bridge state', () => {
            ZigbeeBridge.saveState(ZigbeeBridgeState.Offline);

            expect(ZigbeeBridge.getState()).toBe(ZigbeeBridgeState.Offline);
        });

        it('should normalize a missing state to null', () => {
            ZigbeeBridge.saveState(undefined as unknown as ZigbeeBridgeState);

            expect(ZigbeeBridge.getState()).toBeNull();
        });
    });

    describe('trackDeviceMessage', () => {
        it('should stamp the time of the last device message', () => {
            const now = new Date('2026-01-01T12:00:00.000Z').getTime();
            jest.useFakeTimers().setSystemTime(now);

            ZigbeeBridge.trackDeviceMessage();

            expect(ZigbeeBridge.getLastDeviceMessageAt()).toBe(now);
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

        it('should return false when the bridge announced itself offline', () => {
            ZigbeeBridge.save(makeHealth());
            ZigbeeBridge.saveState(ZigbeeBridgeState.Offline);

            expect(ZigbeeBridge.connected()).toBe(false);
        });

        it('should return false when the health reports went stale', () => {
            ZigbeeBridge.save(makeHealth());
            ZigbeeBridge.markHealthReportsStale(true);

            expect(ZigbeeBridge.connected()).toBe(false);
        });

        it('should return true again once a fresh health report arrives', () => {
            ZigbeeBridge.save(makeHealth());
            ZigbeeBridge.markHealthReportsStale(true);

            ZigbeeBridge.save(makeHealth());

            expect(ZigbeeBridge.connected()).toBe(true);
        });
    });
});
