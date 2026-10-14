import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { ZigbeeBridge } from 'zigbee/store/zigbee-bridge';
import { ZIGBEE_HEALTH_TIMEOUT_MS, ZIGBEE_MONITOR_INTERVAL_MS, ZIGBEE_MONITOR_JOB_NAME } from 'zigbee/zigbee.constants';

@Injectable()
export class ZigbeeHealthMonitorService {
    private readonly logger = new Logger(ZigbeeHealthMonitorService.name);

    // Nothing has been received yet right after the startup, so the outages are measured from it
    private readonly startedAt = Date.now();

    private offlineReported = false;
    private staleHealthReported = false;

    constructor(private readonly configService: ConfigService) {}

    @Interval(ZIGBEE_MONITOR_JOB_NAME, ZIGBEE_MONITOR_INTERVAL_MS)
    checkBridgeHealth(): void {
        if (!this.isEnabled()) {
            return;
        }

        this.checkBridgeAvailability();
        this.checkHealthReports();
    }

    private checkBridgeAvailability(): void {
        if (ZigbeeBridge.isOffline() && !this.offlineReported) {
            this.logger.error('Zigbee2Mqtt has gone offline - the Zigbee devices are not reachable until it is back');
        } else if (ZigbeeBridge.isOnline() && this.offlineReported) {
            this.logger.log('Zigbee2Mqtt is back online');
        }
        this.offlineReported = ZigbeeBridge.isOffline();
    }

    /**
     * Catches a z2m that never came up: the broker keeps no retained messages across restarts (no mosquitto persistence),
     * so after a reboot there may be no "offline" state for the availability check to see
     */
    private checkHealthReports(): void {
        const silentForMs = Date.now() - (ZigbeeBridge.getLastHealthAt() ?? this.startedAt);
        const stale = silentForMs > ZIGBEE_HEALTH_TIMEOUT_MS;

        if (stale && !this.staleHealthReported) {
            this.logger.error(
                `No Zigbee2Mqtt health report has been received for ${Math.round(silentForMs / 60_000)} min - the bridge has most likely stopped working`,
            );
        } else if (!stale && this.staleHealthReported) {
            this.logger.log('Zigbee2Mqtt health reports are being received again');
        }
        this.staleHealthReported = stale;
    }

    private isEnabled(): boolean {
        return this.configService.get<string>('ZIGBEE_MONITOR_ENABLED') === 'true';
    }
}
