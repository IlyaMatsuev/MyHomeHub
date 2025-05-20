import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Device } from 'devices/interfaces';

export abstract class DeviceControlService {
    protected readonly logger: Logger;

    constructor(
        protected readonly device: Device,
        protected readonly configService: ConfigService,
    ) {
        this.logger = new Logger(this.getServiceName());
    }

    protected abstract getServiceName(): string;
    abstract setControls<T>(controls: Record<string, unknown>): Promise<T | void>;

    protected getDeviceIP(): string | never {
        if (!this.device.ip) {
            throw new Error(`The device with id "${this.device.externalId}" does not have an IP address, not possible to set the controls`);
        }
        return this.device.ip;
    }
}
