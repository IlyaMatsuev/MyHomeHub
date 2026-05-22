import { Injectable } from '@nestjs/common';
import { DeviceTransportService, TransportProtocol } from 'devices-control/interfaces';

@Injectable()
export class ZigbeeTransportService implements DeviceTransportService {
    readonly protocol = TransportProtocol.Zigbee;

    async send(): Promise<void> {
        // TODO: No zigbee devices with a state yet
    }
}
