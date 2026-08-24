import { Logger } from '@nestjs/common';
import { Device, DeviceControls, DevicePayload } from 'devices/interfaces';
import { ConfigService } from '@nestjs/config';
import { ClassConstructor } from 'class-transformer/types/interfaces';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CustomValidationException } from 'common/exceptions';
import { DevicePayloadDto } from 'devices/dto';
import { DeviceTransportServiceResolver } from 'devices-control/transport';
import { TransportMessage } from 'devices-control/interfaces';
import { DeviceConfigsMapperService } from 'device-configs/device-configs-mapper.service';
import { DeviceConfigsValidatorService } from 'device-configs/device-configs-validator.service';
import { DeviceConfigValidationPolicy } from 'device-configs/interfaces';
import { stripEmptyValues } from 'devices-control/utils';

export abstract class DevicesControlService {
    protected readonly logger: Logger;

    // TODO: Too many params, inconvenient to initialize
    constructor(
        protected readonly device: Device,
        protected readonly transportServiceResolver: DeviceTransportServiceResolver,
        protected readonly configService: ConfigService,
        protected readonly deviceConfigsMapper: DeviceConfigsMapperService,
        protected readonly deviceConfigsValidator: DeviceConfigsValidatorService,
    ) {
        this.logger = new Logger(this.getServiceName());
    }

    protected abstract getServiceName(): string;
    protected abstract getControlsDtoType<T extends object>(): ClassConstructor<T>;
    protected abstract getControlsPayload<T extends DeviceControls>(controls: T): Promise<TransportMessage | null>;

    protected getMeasurementsDtoType<T extends object>(): ClassConstructor<T> {
        return DevicePayloadDto as ClassConstructor<T>;
    }

    /**
     * Fills the controls and measurements the device config declares but the device does not have yet.
     * The values already set on the device always win over the configured defaults
     */
    async applyConfigDefaults(): Promise<void> {
        const defaults = await this.deviceConfigsValidator.buildDefaultPayloads(this.device);
        this.device.controls = { ...defaults.controls, ...(this.device.controls ?? {}) };
        this.device.measurements = { ...defaults.measurements, ...(this.device.measurements ?? {}) };
    }

    /**
     * The device config rules are applied to the incoming payload, while the brand DTO validates the merged result
     */
    async mergeValidateControls(
        controls: DeviceControls,
        oldControls?: DeviceControls,
        policy = DeviceConfigValidationPolicy.Reject,
    ): Promise<DeviceControls | never> {
        const validated = await this.deviceConfigsValidator.validateSection(this.device, 'controls', controls, policy);
        return this.validatePayload(this.mergePayload(validated, oldControls), this.getControlsDtoType());
    }

    async mergeValidateMeasurements(
        measurements: DevicePayload,
        oldMeasurements?: DevicePayload,
        policy = DeviceConfigValidationPolicy.Reject,
    ): Promise<DevicePayload | never> {
        const validated = await this.deviceConfigsValidator.validateSection(this.device, 'measurements', measurements, policy);
        return this.validatePayload(this.mergePayload(validated, oldMeasurements), this.getMeasurementsDtoType());
    }

    async validateCommand(command: DevicePayload, policy = DeviceConfigValidationPolicy.Reject): Promise<DevicePayload | never> {
        const validated = await this.deviceConfigsValidator.validateSection(this.device, 'commands', command, policy);
        return this.validatePayload(validated, this.getControlsDtoType());
    }

    async setControls<T extends DeviceControls>(controls: T): Promise<void | never> {
        try {
            const payload = await this.getControlsPayload(this.getControlsDto<T>(stripEmptyValues(controls)));
            if (payload) {
                await this.transportServiceResolver.send(this.device.transportProtocol, await this.mapMessagePayload(payload));
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

    private async mapMessagePayload(message: TransportMessage): Promise<TransportMessage> {
        if (!('payload' in message) || !message.payload || typeof message.payload !== 'object') {
            return message;
        }
        const mappedPayload = await this.deviceConfigsMapper.mapPayloadToDevice(this.device, message.payload as DevicePayload);
        return { ...message, payload: mappedPayload } as TransportMessage;
    }

    private getControlsDto<T extends object>(controls: DeviceControls): T {
        return plainToInstance(this.getControlsDtoType<T>(), controls);
    }

    // "$override" replaces the stored payload instead of merging into it, and is never persisted itself
    private mergePayload<T extends DevicePayload>(payload: T, oldPayload?: T): T {
        const { $override, ...otherFields } = payload ?? ({} as T);
        return ($override ? { ...otherFields } : { ...oldPayload, ...otherFields }) as T;
    }

    private async validatePayload<T extends DevicePayload>(payload: T, dtoType: ClassConstructor<T>): Promise<T | never> {
        const errors = await validate(plainToInstance(dtoType, payload));
        if (errors.length) {
            throw CustomValidationException.fromClassValidator(errors);
        }
        return payload;
    }
}
