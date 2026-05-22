import { Logger } from '@nestjs/common';
import { Device, DeviceControls } from 'devices/interfaces';
import { ConfigService } from '@nestjs/config';
import { ClassConstructor } from 'class-transformer/types/interfaces';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CustomValidationException } from 'common/exceptions';
import { DeviceTransportServiceResolver } from 'devices-control/transport';
import { TransportMessage } from 'devices-control/interfaces';

export abstract class DevicesControlService {
    protected readonly logger: Logger;

    constructor(
        protected readonly device: Device,
        protected readonly transportServiceResolver: DeviceTransportServiceResolver,
        protected readonly configService: ConfigService,
    ) {
        this.logger = new Logger(this.getServiceName());
    }

    protected abstract getServiceName(): string;
    protected abstract getControlsDtoType<T extends object>(): ClassConstructor<T>;
    protected abstract getControlsPayload<T extends DeviceControls>(controls: T): Promise<TransportMessage | null>;

    mergeValidateControls(controls: DeviceControls, oldControls?: DeviceControls): Promise<DeviceControls | never> {
        const { $override, ...otherControls } = controls ?? {};
        const mergedControls: DeviceControls = $override ? { ...otherControls } : { ...oldControls, ...otherControls };
        return this.validateControls(mergedControls);
    }

    async validateControls(controls: DeviceControls): Promise<DeviceControls | never> {
        const controlsDto = this.getControlsDto(controls);
        const errors = await validate(controlsDto);
        if (errors.length) {
            throw CustomValidationException.fromClassValidator(errors);
        }
        return controls;
    }

    async setControls<T extends DeviceControls>(controls: T): Promise<void | never> {
        try {
            const payload = await this.getControlsPayload(this.getControlsDto<T>(controls));
            if (payload) {
                await this.transportServiceResolver.send(this.device.transportProtocol, payload);
            } else {
                this.logger.log(`No payload for setting controls/measurements for the device "${this.device.externalId}"`);
            }
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

    private getControlsDto<T extends object>(controls: DeviceControls): T {
        return plainToInstance(this.getControlsDtoType<T>(), controls);
    }
}
