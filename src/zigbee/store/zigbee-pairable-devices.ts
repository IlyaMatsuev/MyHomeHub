import { PairableDevice, ZigbeeDevice } from 'zigbee/interfaces';

export class ZigbeePairableDevices {
    private static pairableDevices: Map<string, PairableDevice> = new Map<string, PairableDevice>();

    static has(ieeeAddress: string): boolean {
        return ZigbeePairableDevices.pairableDevices.has(ieeeAddress);
    }

    static get(ieeeAddress: string): PairableDevice | null {
        return ZigbeePairableDevices.pairableDevices.get(ieeeAddress) || null;
    }

    static getAll(): Array<PairableDevice> {
        return Array.from(ZigbeePairableDevices.pairableDevices.values());
    }

    static save(zigbeeDevices: Array<ZigbeeDevice>) {
        const eligibleZigbeeDevices: Array<[string, PairableDevice]> = zigbeeDevices
            .filter(
                zd =>
                    // "Coordinator" is a zigbee dongle itself
                    zd.type !== 'Coordinator' &&
                    zd.supported &&
                    !zd.disabled &&
                    zd.interview_completed &&
                    zd.interview_state === 'SUCCESSFUL',
            )
            .map(zd => [
                zd.ieee_address,
                {
                    zigbeeIeeeAddress: zd.ieee_address,
                    zigbeeFriendlyName: zd.friendly_name,
                },
            ]);
        ZigbeePairableDevices.pairableDevices = new Map<string, PairableDevice>(eligibleZigbeeDevices);
    }
}
