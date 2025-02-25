import { Device } from 'devices/interfaces';
import { request } from 'gaxios';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

export abstract class BaseDeviceControlService {
    protected constructor(protected readonly device: Device) {}

    async setControls<T>(controls: Record<string, object>): Promise<T> {
        if (!this.device.deviceAddress) {
            throw new Error(`The device with id ${this.device.externalId} does not have an address, not possible to set the controls`);
        }

        const response = await request<T>({
            url: this.getEndpoint(),
            method: this.getMethod(),
            headers: this.getHeaders(),
            data: this.getSetControlsPayload(controls),
        });
        return response.data;
    }

    protected getEndpoint(): string {
        return this.device.deviceAddress;
    }

    protected getMethod(): HttpMethod {
        return 'POST';
    }

    protected getHeaders(): Record<string, string> {
        return {};
    }

    protected abstract getSetControlsPayload(controls: Record<string, object>): string | Record<string, unknown>;
}
