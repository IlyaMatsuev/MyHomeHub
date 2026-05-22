import { Injectable } from '@nestjs/common';
import { DeviceTransportService, TransportMessage, TransportProtocol } from 'devices-control/interfaces';

@Injectable()
export class DeviceTransportServiceResolver {
    constructor(private readonly transportServices: Array<DeviceTransportService>) {}

    send(protocol: TransportProtocol, message: TransportMessage): Promise<void> {
        const transport = this.transportServices.find(t => t.protocol === protocol);
        if (!transport) {
            throw new Error(`No transport service registered for protocol "${protocol}"`);
        }
        return transport.send(message);
    }
}
