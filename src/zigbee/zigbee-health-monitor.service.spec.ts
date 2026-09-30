import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ZigbeeHealthMonitorService } from './zigbee-health-monitor.service';
import { ZigbeeBridgeState } from './interfaces';
import { ZigbeePairableDevices } from './store';
import { ZigbeeBridge } from './store/zigbee-bridge';
import { DEFAULT_ZIGBEE_HEALTH_TIMEOUT_SEC, DEFAULT_ZIGBEE_SILENCE_TIMEOUT_SEC } from './zigbee.constants';

describe('ZigbeeHealthMonitorService', () => {
    const now = new Date('2026-01-01T12:00:00.000Z').getTime();
    const minutesAgo = (minutes: number): number => now - minutes * 60 * 1000;

    let service: ZigbeeHealthMonitorService;
    let config: Record<string, string>;
    let errorSpy: jest.SpyInstance;
    let logSpy: jest.SpyInstance;
    let markStaleSpy: jest.SpyInstance;

    const buildService = async (): Promise<ZigbeeHealthMonitorService> => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [ZigbeeHealthMonitorService, { provide: ConfigService, useValue: { get: (name: string) => config[name] } }],
        }).compile();
        return module.get<ZigbeeHealthMonitorService>(ZigbeeHealthMonitorService);
    };

    beforeEach(async () => {
        jest.useFakeTimers({ doNotFake: ['setInterval'] }).setSystemTime(now);
        config = {};

        errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
        jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

        markStaleSpy = jest.spyOn(ZigbeeBridge, 'markHealthReportsStale').mockImplementation(() => undefined);
        jest.spyOn(ZigbeeBridge, 'getState').mockReturnValue(ZigbeeBridgeState.Online);
        jest.spyOn(ZigbeeBridge, 'getLastHealthAt').mockReturnValue(now);
        jest.spyOn(ZigbeeBridge, 'getLastDeviceMessageAt').mockReturnValue(now);
        jest.spyOn(ZigbeePairableDevices, 'getAll').mockReturnValue([{ zigbeeIeeeAddress: '0x001', zigbeeFriendlyName: 'bulb' }]);

        service = await buildService();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    describe('when everything is healthy', () => {
        it('should not report anything', () => {
            service.checkBridgeHealth();

            expect(errorSpy).not.toHaveBeenCalled();
            expect(markStaleSpy).toHaveBeenCalledWith(false);
        });
    });

    describe('bridge availability', () => {
        it('should report an error once when the bridge announces itself offline', () => {
            jest.spyOn(ZigbeeBridge, 'getState').mockReturnValue(ZigbeeBridgeState.Offline);

            service.checkBridgeHealth();
            service.checkBridgeHealth();

            expect(errorSpy).toHaveBeenCalledTimes(1);
            expect(errorSpy.mock.calls[0][0]).toContain('offline');
        });

        it('should report the recovery when the bridge is back online', () => {
            const getState = jest.spyOn(ZigbeeBridge, 'getState').mockReturnValue(ZigbeeBridgeState.Offline);
            service.checkBridgeHealth();

            getState.mockReturnValue(ZigbeeBridgeState.Online);
            service.checkBridgeHealth();

            expect(logSpy).toHaveBeenCalledWith('Zigbee2Mqtt is back online');
        });

        it('should not report an unknown bridge state as an outage', () => {
            jest.spyOn(ZigbeeBridge, 'getState').mockReturnValue(null);

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
            expect(markStaleSpy).toHaveBeenCalledWith(true);
        });

        it('should keep quiet while the last report is still within the default timeout', () => {
            jest.spyOn(ZigbeeBridge, 'getLastHealthAt').mockReturnValue(now - DEFAULT_ZIGBEE_HEALTH_TIMEOUT_SEC * 1000);

            service.checkBridgeHealth();

            expect(errorSpy).not.toHaveBeenCalled();
        });

        it('should honor the configured timeout', () => {
            config.ZIGBEE_HEALTH_TIMEOUT_SEC = '300';
            jest.spyOn(ZigbeeBridge, 'getLastHealthAt').mockReturnValue(minutesAgo(10));

            service.checkBridgeHealth();

            expect(errorSpy).toHaveBeenCalledTimes(1);
        });

        it('should fall back to the default timeout when the configured one is not a positive number', () => {
            config.ZIGBEE_HEALTH_TIMEOUT_SEC = 'not-a-number';
            jest.spyOn(ZigbeeBridge, 'getLastHealthAt').mockReturnValue(minutesAgo(31));

            service.checkBridgeHealth();

            expect(errorSpy).toHaveBeenCalledTimes(1);
            expect(errorSpy.mock.calls[0][0]).toContain('health report');
        });

        it('should measure the outage from the startup when no report has ever arrived', async () => {
            jest.spyOn(ZigbeeBridge, 'getLastHealthAt').mockReturnValue(null);
            service = await buildService();

            service.checkBridgeHealth();
            expect(errorSpy).not.toHaveBeenCalled();

            jest.setSystemTime(now + (DEFAULT_ZIGBEE_HEALTH_TIMEOUT_SEC + 1) * 1000);
            service.checkBridgeHealth();

            expect(errorSpy).toHaveBeenCalledTimes(1);
        });

        it('should report the recovery when the health reports are received again', () => {
            const getLastHealthAt = jest.spyOn(ZigbeeBridge, 'getLastHealthAt').mockReturnValue(minutesAgo(45));
            service.checkBridgeHealth();

            getLastHealthAt.mockReturnValue(now);
            service.checkBridgeHealth();

            expect(logSpy).toHaveBeenCalledWith('Zigbee2Mqtt health reports are being received again');
            expect(markStaleSpy).toHaveBeenLastCalledWith(false);
        });
    });

    describe('devices silence', () => {
        it('should report an error once when no device reported within the timeout', () => {
            jest.spyOn(ZigbeeBridge, 'getLastDeviceMessageAt').mockReturnValue(minutesAgo(90));

            service.checkBridgeHealth();
            service.checkBridgeHealth();

            expect(errorSpy).toHaveBeenCalledTimes(1);
            expect(errorSpy.mock.calls[0][0]).toContain('No Zigbee device has reported to the hub for 90 min');
        });

        it('should keep quiet while the last device message is within the default timeout', () => {
            jest.spyOn(ZigbeeBridge, 'getLastDeviceMessageAt').mockReturnValue(now - DEFAULT_ZIGBEE_SILENCE_TIMEOUT_SEC * 1000);

            service.checkBridgeHealth();

            expect(errorSpy).not.toHaveBeenCalled();
        });

        it('should honor the configured timeout', () => {
            config.ZIGBEE_SILENCE_TIMEOUT_SEC = '600';
            jest.spyOn(ZigbeeBridge, 'getLastDeviceMessageAt').mockReturnValue(minutesAgo(20));

            service.checkBridgeHealth();

            expect(errorSpy).toHaveBeenCalledTimes(1);
        });

        it('should not report a silence on a hub with no Zigbee devices around', () => {
            jest.spyOn(ZigbeePairableDevices, 'getAll').mockReturnValue([]);
            jest.spyOn(ZigbeeBridge, 'getLastDeviceMessageAt').mockReturnValue(minutesAgo(90));

            service.checkBridgeHealth();

            expect(errorSpy).not.toHaveBeenCalled();
        });

        it('should not report a silence on top of an already reported bridge outage', () => {
            jest.spyOn(ZigbeeBridge, 'getState').mockReturnValue(ZigbeeBridgeState.Offline);
            jest.spyOn(ZigbeeBridge, 'getLastDeviceMessageAt').mockReturnValue(minutesAgo(90));

            service.checkBridgeHealth();

            expect(errorSpy).toHaveBeenCalledTimes(1);
            expect(errorSpy.mock.calls[0][0]).toContain('offline');
        });

        it('should not report a silence on top of an already reported stale health report', () => {
            jest.spyOn(ZigbeeBridge, 'getLastHealthAt').mockReturnValue(minutesAgo(45));
            jest.spyOn(ZigbeeBridge, 'getLastDeviceMessageAt').mockReturnValue(minutesAgo(90));

            service.checkBridgeHealth();

            expect(errorSpy).toHaveBeenCalledTimes(1);
            expect(errorSpy.mock.calls[0][0]).toContain('health report');
        });

        it('should report the recovery when the devices are reporting again', () => {
            const getLastMessageAt = jest.spyOn(ZigbeeBridge, 'getLastDeviceMessageAt').mockReturnValue(minutesAgo(90));
            service.checkBridgeHealth();

            getLastMessageAt.mockReturnValue(now);
            service.checkBridgeHealth();

            expect(logSpy).toHaveBeenCalledWith('Zigbee devices are reporting to the hub again');
        });
    });

    describe('when the monitoring is disabled', () => {
        it('should skip every check', () => {
            config.ZIGBEE_MONITOR_ENABLED = 'false';
            jest.spyOn(ZigbeeBridge, 'getState').mockReturnValue(ZigbeeBridgeState.Offline);
            jest.spyOn(ZigbeeBridge, 'getLastHealthAt').mockReturnValue(minutesAgo(45));

            service.checkBridgeHealth();

            expect(errorSpy).not.toHaveBeenCalled();
            expect(markStaleSpy).not.toHaveBeenCalled();
        });
    });
});
