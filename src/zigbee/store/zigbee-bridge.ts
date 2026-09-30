import { Logger } from '@nestjs/common';
import { ZigbeeBridgeHealth, ZigbeeBridgeState } from 'zigbee/interfaces';

export class ZigbeeBridge {
    private static readonly logger = new Logger(ZigbeeBridge.name);

    private static health: ZigbeeBridgeHealth = null;
    private static state: ZigbeeBridgeState = null;
    private static lastHealthAt: number = null;
    private static lastDeviceMessageAt: number = null;
    private static healthReportsStale = false;

    /**
     * I do not throw an error if z2m is not connected due to inconvenience during development
     * z2m works only with a Zigbee dongle
     */
    static connected(): boolean {
        if (!ZigbeeBridge.health || !ZigbeeBridge.health.mqtt.connected) {
            this.logger.warn('Zigbee2Mqtt is not running or the MQTT broker is not connected');
            this.logger.debug(`Latest health report: ${JSON.stringify(ZigbeeBridge.health)}`);
            return false;
        }
        if (ZigbeeBridge.state === ZigbeeBridgeState.Offline) {
            this.logger.warn('Zigbee2Mqtt has announced itself offline');
            return false;
        }
        // Set by ZigbeeHealthMonitorService, so the cached health report is not trusted forever
        if (ZigbeeBridge.healthReportsStale) {
            this.logger.warn('Zigbee2Mqtt stopped publishing health reports');
            return false;
        }
        return true;
    }

    static save(health: ZigbeeBridgeHealth) {
        ZigbeeBridge.health = health || null;
        if (ZigbeeBridge.health) {
            ZigbeeBridge.lastHealthAt = Date.now();
            ZigbeeBridge.healthReportsStale = false;
        }
    }

    static saveState(state: ZigbeeBridgeState) {
        ZigbeeBridge.state = state || null;
    }

    static trackDeviceMessage() {
        ZigbeeBridge.lastDeviceMessageAt = Date.now();
    }

    static markHealthReportsStale(stale: boolean) {
        ZigbeeBridge.healthReportsStale = stale;
    }

    static getState(): ZigbeeBridgeState {
        return ZigbeeBridge.state;
    }

    static getLastHealthAt(): number {
        return ZigbeeBridge.lastHealthAt;
    }

    static getLastDeviceMessageAt(): number {
        return ZigbeeBridge.lastDeviceMessageAt;
    }
}
