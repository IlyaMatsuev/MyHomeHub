import { Injectable, Logger } from '@nestjs/common';
import { Device, DevicePayload } from 'devices/interfaces';
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
    protected abstract setDeviceControls<T extends DevicePayload, V>(controls: T): Promise<V | void | never>;

    mergeValidateControls(controls: DevicePayload, oldControls?: DevicePayload): Promise<DevicePayload | never> {
        this.logger.debug(`Controls to merge: ${JSON.stringify(controls)}`);
        const { $override, ...otherControls } = controls ?? {};
        const mergedControls: DevicePayload = $override ? { ...otherControls } : { ...oldControls, ...otherControls };
        return this.validateControls(mergedControls);
    }

    async validateControls(controls: DevicePayload): Promise<DevicePayload | never> {
        const controlsDto = this.getControlsDto(controls);
        const errors = await validate(controlsDto);
        if (errors.length) {
            throw CustomValidationException.fromClassValidator(errors);
        }
        return controls;
    }

    setControls<T extends DevicePayload>(controls: DevicePayload): Promise<T | void | never> {
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

    private getControlsDto<T extends object>(controls: DevicePayload): T {
        return plainToInstance(this.getControlsDtoType<T>(), controls);
    }
}
