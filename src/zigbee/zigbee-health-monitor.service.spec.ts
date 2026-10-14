import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ZigbeeHealthMonitorService } from './zigbee-health-monitor.service';
import { ZigbeeBridgeState } from './interfaces';
import { ZigbeeBridge } from './store/zigbee-bridge';
import { ZIGBEE_HEALTH_TIMEOUT_MS } from './zigbee.constants';

describe('ZigbeeHealthMonitorService', () => {
    const now = new Date('2026-01-01T12:00:00.000Z').getTime();
    const minutesAgo = (minutes: number): number => now - minutes * 60 * 1000;

    let service: ZigbeeHealthMonitorService;
    let config: Record<string, string>;
    let errorSpy: jest.SpyInstance;
    let logSpy: jest.SpyInstance;

    const buildService = async (): Promise<ZigbeeHealthMonitorService> => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [ZigbeeHealthMonitorService, { provide: ConfigService, useValue: { get: (name: string) => config[name] } }],
        }).compile();
        return module.get<ZigbeeHealthMonitorService>(ZigbeeHealthMonitorService);
    };

    beforeEach(async () => {
        jest.useFakeTimers({ doNotFake: ['setInterval'] }).setSystemTime(now);
        config = { ZIGBEE_MONITOR_ENABLED: 'true' };

        errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
        jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

        ZigbeeBridge.saveState(ZigbeeBridgeState.Online);
        jest.spyOn(ZigbeeBridge, 'getLastHealthAt').mockReturnValue(now);

        service = await buildService();
    });

    afterEach(() => {
        ZigbeeBridge.saveState(null);
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    describe('when everything is healthy', () => {
        it('should not report anything', () => {
            service.checkBridgeHealth();

            expect(errorSpy).not.toHaveBeenCalled();
        });
    });

    describe('bridge availability', () => {
        it('should report an error once when the bridge announces itself offline', () => {
            ZigbeeBridge.saveState(ZigbeeBridgeState.Offline);

            service.checkBridgeHealth();
            service.checkBridgeHealth();

            expect(errorSpy).toHaveBeenCalledTimes(1);
            expect(errorSpy.mock.calls[0][0]).toContain('offline');
        });

        it('should report the recovery when the bridge is back online', () => {
            ZigbeeBridge.saveState(ZigbeeBridgeState.Offline);
            service.checkBridgeHealth();

            ZigbeeBridge.saveState(ZigbeeBridgeState.Online);
            service.checkBridgeHealth();

            expect(logSpy).toHaveBeenCalledWith('Zigbee2Mqtt is back online');
        });

        it('should not report a recovery when the state becomes unknown after an outage', () => {
            ZigbeeBridge.saveState(ZigbeeBridgeState.Offline);
            service.checkBridgeHealth();

            ZigbeeBridge.saveState(null);
            service.checkBridgeHealth();

            expect(logSpy).not.toHaveBeenCalledWith('Zigbee2Mqtt is back online');
        });

        it('should not report an unknown bridge state as an outage', () => {
            ZigbeeBridge.saveState(null);

            service.checkBridgeHealth();

            expect(errorSpy).not.toHaveBeenCalled();
        });
    });

    describe('health report freshness', () => {
        it('should report an error once when no health report arrived within the timeout', () => {
            jest.spyOn(ZigbeeBridge, 'getLastHealthAt').mockReturnValue(minutesAgo(45));

            service.checkBridgeHealth();
            service.checkBridgeHealth();

            expect(errorSpy).toHaveBeenCalledTimes(1);
            expect(errorSpy.mock.calls[0][0]).toContain('No Zigbee2Mqtt health report has been received for 45 min');
        });

        it('should keep quiet while the last report is still within the timeout', () => {
            jest.spyOn(ZigbeeBridge, 'getLastHealthAt').mockReturnValue(now - ZIGBEE_HEALTH_TIMEOUT_MS);

            service.checkBridgeHealth();

            expect(errorSpy).not.toHaveBeenCalled();
        });

        it('should measure the outage from the startup when no report has ever arrived', async () => {
            jest.spyOn(ZigbeeBridge, 'getLastHealthAt').mockReturnValue(null);
            service = await buildService();

            service.checkBridgeHealth();
            expect(errorSpy).not.toHaveBeenCalled();

            jest.setSystemTime(now + ZIGBEE_HEALTH_TIMEOUT_MS + 1000);
            service.checkBridgeHealth();

            expect(errorSpy).toHaveBeenCalledTimes(1);
        });

        it('should report the recovery when the health reports are received again', () => {
            const getLastHealthAt = jest.spyOn(ZigbeeBridge, 'getLastHealthAt').mockReturnValue(minutesAgo(45));
            service.checkBridgeHealth();

            getLastHealthAt.mockReturnValue(now);
            service.checkBridgeHealth();

            expect(logSpy).toHaveBeenCalledWith('Zigbee2Mqtt health reports are being received again');
        });
    });

    describe('when the monitoring is disabled', () => {
        it('should skip every check unless explicitly enabled', () => {
            delete config.ZIGBEE_MONITOR_ENABLED;
            ZigbeeBridge.saveState(ZigbeeBridgeState.Offline);
            jest.spyOn(ZigbeeBridge, 'getLastHealthAt').mockReturnValue(minutesAgo(45));

            service.checkBridgeHealth();

            expect(errorSpy).not.toHaveBeenCalled();
        });
    });
});
