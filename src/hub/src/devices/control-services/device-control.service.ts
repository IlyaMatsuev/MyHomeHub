import { Logger } from '@nestjs/common';
import { Device } from 'devices/interfaces';

export abstract class DeviceControlService {
    protected readonly logger: Logger;

    protected constructor(
        protected readonly device: Device,
        context: string = DeviceControlService.name,
    ) {
        this.logger = new Logger(context);
    }

    abstract setControls<T>(controls: Record<string, unknown>): Promise<T>;
}
