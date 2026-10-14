import { Logger } from '@nestjs/common';
import { ZigbeeBridgeHealth, ZigbeeBridgeState } from 'zigbee/interfaces';

export class ZigbeeBridge {
    private static readonly logger = new Logger(ZigbeeBridge.name);

    private static health: ZigbeeBridgeHealth = null;
    private static state: ZigbeeBridgeState = null;
    private static lastHealthAt: number = null;

    static connected(): boolean {
        if (!ZigbeeBridge.health || !ZigbeeBridge.health.mqtt.connected) {
            this.logger.warn('Zigbee2Mqtt is not running or the MQTT broker is not connected');
            this.logger.debug(`Latest health report: ${JSON.stringify(ZigbeeBridge.health)}`);
            return false;
        }
        return true;
    }

    static saveHealth(health: ZigbeeBridgeHealth) {
        ZigbeeBridge.health = health || null;
        if (ZigbeeBridge.health) {
            ZigbeeBridge.lastHealthAt = Date.now();
        }
    }

    static saveState(state: ZigbeeBridgeState) {
        ZigbeeBridge.state = state || null;
    }

    static isOnline(): boolean {
        return ZigbeeBridge.state === ZigbeeBridgeState.Online;
    }

    static isOffline(): boolean {
        return ZigbeeBridge.state === ZigbeeBridgeState.Offline;
    }

    static getLastHealthAt(): number {
        return ZigbeeBridge.lastHealthAt;
    }
}
