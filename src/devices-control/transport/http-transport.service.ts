import { Injectable } from '@nestjs/common';
import { request } from 'gaxios';
import { DeviceTransportService, HttpMessage, TransportProtocol } from 'devices-control/interfaces';

@Injectable()
export class HttpTransportService implements DeviceTransportService {
    readonly protocol = TransportProtocol.Http;

    async send(message: HttpMessage): Promise<void> {
        await request({
            url: message.url,
            method: message.method,
            data: message.payload,
        });
    }
}
