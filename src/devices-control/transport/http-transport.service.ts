import { Injectable } from '@nestjs/common';
import { request } from 'gaxios';
import { DeviceTransportService, HttpMessage, TransportProtocol } from 'devices-control/interfaces';
import { DEVICE_STATE_READ_TIMEOUT_MS } from 'devices-control/devices-control.constants';

@Injectable()
export class HttpTransportService implements DeviceTransportService {
    readonly protocol = TransportProtocol.Http;

    async send(message: HttpMessage): Promise<void> {
        await this.request(message);
    }

    async receive(message: HttpMessage): Promise<unknown> {
        const response = await this.request(message, DEVICE_STATE_READ_TIMEOUT_MS);
        return response.data;
    }

    private request(message: HttpMessage, timeout?: number) {
        return request({
            url: message.url,
            method: message.method,
            data: message.payload,
            ...(timeout && { timeout }),
        });
    }
}
