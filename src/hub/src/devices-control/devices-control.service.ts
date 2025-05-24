import { Injectable, Logger } from '@nestjs/common';
import { Device } from 'devices/interfaces';
import { ConfigService } from '@nestjs/config';
import { ClassConstructor } from 'class-transformer/types/interfaces';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CustomValidationException } from 'common/exceptions';

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
    protected abstract getControlsDtoType<T extends object>(): ClassConstructor<T>;
    protected abstract setDeviceControls<T extends Record<string, unknown>, V>(controls: T): Promise<V | void | never>;

    async validateControls(controls: Record<string, unknown>): Promise<void | never> {
        const controlsDto = this.getControlsDto(controls);
        const errors = await validate(controlsDto);
        if (errors.length) {
            throw CustomValidationException.fromClassValidator(errors);
        }
    }

    setControls<T extends Record<string, unknown>>(controls: Record<string, unknown>): Promise<T | void | never> {
        try {
            return this.setDeviceControls(this.getControlsDto<T>(controls));
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

    private getControlsDto<T extends object>(controls: Record<string, unknown>): T {
        return plainToInstance(this.getControlsDtoType<T>(), controls);
    }
}
