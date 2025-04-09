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
}
