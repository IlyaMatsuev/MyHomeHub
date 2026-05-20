import { Logger } from '@nestjs/common';
import { ZigbeeBridgeHealth } from 'zigbee/interfaces';

export class ZigbeeBridge {
    private static readonly logger = new Logger(ZigbeeBridge.name);

    private static health: ZigbeeBridgeHealth = null;

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
        return true;
    }

    static save(health: ZigbeeBridgeHealth) {
        ZigbeeBridge.health = health || null;
    }
}
