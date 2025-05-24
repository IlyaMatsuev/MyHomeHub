import { Injectable, Logger } from '@nestjs/common';
import { Device } from 'devices/interfaces';
import { ConfigService } from '@nestjs/config';

@Injectable()
export abstract class DevicesControlService {
    protected readonly logger: Logger;

    constructor(
        protected readonly device: Device,
        protected readonly configService: ConfigService,
    ) {
        this.logger = new Logger(this.getServiceName());
    }

    protected abstract getServiceName(): string;
    protected abstract setDeviceControls<T>(controls: Record<string, unknown>): Promise<T | void | never>;

    setControls<T>(controls: Record<string, unknown>): Promise<T | void | never> {
        try {
            return this.setDeviceControls(controls);
        } catch (error) {
            this.logger.error(`Failed to set controls: ${error}`);
        }
    }

    protected getDeviceIP(): string | never {
        if (!this.device.ip) {
            throw new Error(`The device with id "${this.device.externalId}" does not have an IP address, not possible to set the controls`);
        }
        return this.device.ip;
    }
}
