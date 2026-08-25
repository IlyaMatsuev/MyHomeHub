import { Injectable } from '@nestjs/common';
import { DeviceTransportService, TransportMessage, TransportProtocol } from 'devices-control/interfaces';

@Injectable()
export class DeviceTransportServiceResolver {
    constructor(private readonly transportServices: Array<DeviceTransportService>) {}

    send(protocol: TransportProtocol, message: TransportMessage): Promise<void> {
        return this.resolve(protocol).send(message);
    }

    receive(protocol: TransportProtocol, message: TransportMessage): Promise<unknown | never> {
        const transport = this.resolve(protocol);
        if (!transport.receive) {
            throw new Error(`Transport service for protocol "${protocol}" cannot read a device state`);
        }
        return transport.receive(message);
    }

    private resolve(protocol: TransportProtocol): DeviceTransportService | never {
        const transport = this.transportServices.find(t => t.protocol === protocol);
        if (!transport) {
            throw new Error(`No transport service registered for protocol "${protocol}"`);
        }
        return transport;
    }
}
