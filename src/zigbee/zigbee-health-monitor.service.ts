import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { ZigbeeBridgeState } from 'zigbee/interfaces';
import { ZigbeePairableDevices } from 'zigbee/store';
import { ZigbeeBridge } from 'zigbee/store/zigbee-bridge';
import {
    DEFAULT_ZIGBEE_HEALTH_TIMEOUT_SEC,
    DEFAULT_ZIGBEE_SILENCE_TIMEOUT_SEC,
    ZIGBEE_MONITOR_INTERVAL_MS,
    ZIGBEE_MONITOR_JOB_NAME,
} from 'zigbee/zigbee.constants';

const SECOND_MS = 1000;

/**
 * Watches the zigbee2mqtt bridge, because a Zigbee dongle that stopped working is otherwise silent:
 * the hub simply receives no device updates, which looks exactly like a quiet home.
 *
 * Three independent signals are checked, each reported once when it breaks and once when it recovers:
 * - the bridge availability topic - the broker publishes the zigbee2mqtt last will when its process dies;
 * - the freshness of the bridge health reports - zigbee2mqtt hung or lost the connection to the broker;
 * - the time since the last Zigbee device message - the bridge is alive, but the dongle receives nothing.
 */
@Injectable()
export class ZigbeeHealthMonitorService {
    private readonly logger = new Logger(ZigbeeHealthMonitorService.name);

    // Nothing has been received yet right after the startup, so the outages are measured from it
    private readonly startedAt = Date.now();

    private offlineReported = false;
    private staleHealthReported = false;
    private devicesSilenceReported = false;

    constructor(private readonly configService: ConfigService) {}

    @Interval(ZIGBEE_MONITOR_JOB_NAME, ZIGBEE_MONITOR_INTERVAL_MS)
    checkBridgeHealth(): void {
        if (!this.isEnabled()) {
            return;
        }

        this.checkBridgeAvailability();
        this.checkHealthReports();
        this.checkDevicesSilence();
    }

    private checkBridgeAvailability(): void {
        const offline = ZigbeeBridge.getState() === ZigbeeBridgeState.Offline;

        if (offline && !this.offlineReported) {
            this.logger.error('Zigbee2Mqtt has gone offline - the Zigbee devices are not reachable until it is back');
        } else if (!offline && this.offlineReported) {
            this.logger.log('Zigbee2Mqtt is back online');
        }
        this.offlineReported = offline;
    }

    private checkHealthReports(): void {
        const timeoutMs = this.getTimeoutSec('ZIGBEE_HEALTH_TIMEOUT_SEC', DEFAULT_ZIGBEE_HEALTH_TIMEOUT_SEC) * SECOND_MS;
        const silentForMs = Date.now() - (ZigbeeBridge.getLastHealthAt() ?? this.startedAt);
        const stale = silentForMs > timeoutMs;

        ZigbeeBridge.markHealthReportsStale(stale);

        if (stale && !this.staleHealthReported) {
            this.logger.error(
                `No Zigbee2Mqtt health report has been received for ${this.toMinutes(silentForMs)} min - ` +
                    'the bridge or the Zigbee dongle has most likely stopped working',
            );
        } else if (!stale && this.staleHealthReported) {
            this.logger.log('Zigbee2Mqtt health reports are being received again');
        }
        this.staleHealthReported = stale;
    }

    /**
     * Only reported while the bridge itself looks healthy - otherwise this is the very same outage reported twice.
     * A hub with no Zigbee devices around has nothing to go silent, so it is never reported either.
     */
    private checkDevicesSilence(): void {
        if (this.offlineReported || this.staleHealthReported || !ZigbeePairableDevices.getAll().length) {
            return;
        }

        const timeoutMs = this.getTimeoutSec('ZIGBEE_SILENCE_TIMEOUT_SEC', DEFAULT_ZIGBEE_SILENCE_TIMEOUT_SEC) * SECOND_MS;
        const silentForMs = Date.now() - (ZigbeeBridge.getLastDeviceMessageAt() ?? this.startedAt);
        const silent = silentForMs > timeoutMs;

        if (silent && !this.devicesSilenceReported) {
            this.logger.error(
                `No Zigbee device has reported to the hub for ${this.toMinutes(silentForMs)} min while Zigbee2Mqtt is running - ` +
                    'the Zigbee dongle has most likely stopped working',
            );
        } else if (!silent && this.devicesSilenceReported) {
            this.logger.log('Zigbee devices are reporting to the hub again');
        }
        this.devicesSilenceReported = silent;
    }

    private isEnabled(): boolean {
        return this.configService.get<string>('ZIGBEE_MONITOR_ENABLED') !== 'false';
    }

    private getTimeoutSec(variableName: string, defaultValue: number): number {
        const timeout = Number(this.configService.get<string>(variableName));
        return Number.isFinite(timeout) && timeout > 0 ? timeout : defaultValue;
    }

    private toMinutes(milliseconds: number): number {
        return Math.round(milliseconds / SECOND_MS / 60);
    }
}
