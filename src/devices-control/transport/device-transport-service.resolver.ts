import { Injectable } from '@nestjs/common';
import { DeviceTransportService, TransportMessage } from 'devices-control/interfaces';

@Injectable()
export class DeviceTransportServiceResolver {
    constructor(private readonly transportServices: Array<DeviceTransportService>) {}

    send(message: TransportMessage): Promise<void> {
        const transport = this.transportServices.find(t => t.protocol === message.protocol);
        if (!transport) {
            throw new Error(`No transport service registered for protocol "${message.protocol}"`);
        }
        return transport.send(message);
    }
}
