import { ConfigService } from '@nestjs/config';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { ClassConstructor } from 'class-transformer/types/interfaces';
import { DevicesControlService } from './devices-control.service';
import { DeviceTransportServiceResolver } from 'devices-control/transport';
import { TransportMessage, TransportProtocol } from 'devices-control/interfaces';
import { Device, DeviceControls } from 'devices/interfaces';
import { DeviceConfigsMapperService } from 'device-configs/device-configs-mapper.service';
import { DeviceConfigsValidatorService } from 'device-configs/device-configs-validator.service';
import { CustomValidationException } from 'common/exceptions';

class TestControlsDto {
    @IsOptional()
    @IsBoolean()
    on?: boolean;
}

class TestMeasurementsDto {
    @IsOptional()
    @IsNumber()
    power?: number;
}

class TestControlService extends DevicesControlService {
    payload: TransportMessage | null = null;
    payloadError: Error | null = null;

    protected getServiceName(): string {
        return TestControlService.name;
    }

    protected getControlsDtoType<T extends object>(): ClassConstructor<T> {
        return TestControlsDto as ClassConstructor<T>;
    }

    protected async getControlsPayload(): Promise<TransportMessage | null> {
        if (this.payloadError) {
            throw this.payloadError;
        }
        return this.payload;
    }
}

class TestTypedMeasurementsControlService extends TestControlService {
    protected getMeasurementsDtoType<T extends object>(): ClassConstructor<T> {
        return TestMeasurementsDto as ClassConstructor<T>;
    }
}

describe('DevicesControlService', () => {
    let service: TestControlService;
    let mockResolver: { send: jest.Mock };
    let mockDeviceConfigsMapper: { mapPayloadToDevice: jest.Mock };
    let mockDeviceConfigsValidator: {
        validateSection: jest.Mock;
        buildDefaultPayloads: jest.Mock;
    };
    let logErrorSpy: jest.SpyInstance;

    let mockDevice: Partial<Device>;

    beforeEach(() => {
        mockDevice = {
            externalId: 'device-uuid-123',
            transportProtocol: TransportProtocol.Http,
        };
        mockResolver = { send: jest.fn().mockResolvedValue(undefined) };
        mockDeviceConfigsMapper = { mapPayloadToDevice: jest.fn((_key, payload) => Promise.resolve(payload)) };
        mockDeviceConfigsValidator = {
            validateSection: jest.fn((_key, _section, payload) => Promise.resolve(payload)),
            buildDefaultPayloads: jest.fn().mockResolvedValue({ controls: {}, measurements: {} }),
        };
        service = new TestControlService(
            mockDevice as Device,
            mockResolver as unknown as DeviceTransportServiceResolver,
            {} as ConfigService,
            mockDeviceConfigsMapper as unknown as DeviceConfigsMapperService,
            mockDeviceConfigsValidator as unknown as DeviceConfigsValidatorService,
        );
        logErrorSpy = jest.spyOn(service['logger'], 'error').mockImplementation();
        jest.spyOn(service['logger'], 'log').mockImplementation();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('mergeValidateControls', () => {
        it('should merge the provided controls into the stored ones', async () => {
            const merged = await service.mergeValidateControls({ on: true }, { on: false, brightness: 40 });

            expect(merged).toEqual({ on: true, brightness: 40 });
        });

        it('should validate the incoming controls against the device config before merging', async () => {
            await service.mergeValidateControls({ on: true }, { on: false });

            expect(mockDeviceConfigsValidator.validateSection).toHaveBeenCalledWith(mockDevice, 'controls', { on: true }, 'reject');
        });

        it('should merge the payload sanitized by the device config validation', async () => {
            mockDeviceConfigsValidator.validateSection.mockResolvedValue({ on: true });

            const merged = await service.mergeValidateControls({ on: true, junk: 'x' }, { brightness: 40 });

            expect(merged).toEqual({ on: true, brightness: 40 });
        });

        it('should replace the stored controls when $override is set', async () => {
            const merged = await service.mergeValidateControls({ $override: true, on: true }, { on: false, brightness: 40 });

            expect(merged).toEqual({ on: true });
        });

        it('should not persist the $override flag itself', async () => {
            const merged = await service.mergeValidateControls({ $override: true, on: true }, {});

            expect(merged).not.toHaveProperty('$override');
        });

        it('should throw a validation exception when a merged control is invalid', async () => {
            await expect(service.mergeValidateControls({ on: 'yes' } as unknown as DeviceControls, {})).rejects.toThrow(
                CustomValidationException,
            );
        });
    });

    describe('mergeValidateMeasurements', () => {
        it('should merge the provided measurements into the stored ones', async () => {
            // Devices reporting a single changed value must not wipe the rest of the stored measurements
            const merged = await service.mergeValidateMeasurements({ power: 4.5 }, { power: 10, voltage: 238, current: 0.029 });

            expect(merged).toEqual({ power: 4.5, voltage: 238, current: 0.029 });
        });

        it('should replace the stored measurements when $override is set', async () => {
            const merged = await service.mergeValidateMeasurements({ $override: true, power: 4.5 }, { power: 10, voltage: 238 });

            expect(merged).toEqual({ power: 4.5 });
        });

        it('should not persist the $override flag itself', async () => {
            const merged = await service.mergeValidateMeasurements({ $override: true, power: 4.5 }, {});

            expect(merged).not.toHaveProperty('$override');
        });

        it('should keep the measurements the default payload dto does not describe', async () => {
            const merged = await service.mergeValidateMeasurements({ aenergy: { total: 14.982 } }, {});

            expect(merged).toEqual({ aenergy: { total: 14.982 } });
        });

        it('should throw a validation exception when the brand measurements dto rejects a value', async () => {
            const typedService = new TestTypedMeasurementsControlService(
                mockDevice as Device,
                mockResolver as unknown as DeviceTransportServiceResolver,
                {} as ConfigService,
                mockDeviceConfigsMapper as unknown as DeviceConfigsMapperService,
                mockDeviceConfigsValidator as unknown as DeviceConfigsValidatorService,
            );

            await expect(typedService.mergeValidateMeasurements({ power: 'a lot' }, {})).rejects.toThrow(CustomValidationException);
        });
    });

    describe('applyConfigDefaults', () => {
        it('should seed the controls and measurements declared in the device config', async () => {
            mockDeviceConfigsValidator.buildDefaultPayloads.mockResolvedValue({
                controls: { on: null, brightness: 50 },
                measurements: { power: null },
            });

            await service.applyConfigDefaults();

            expect(mockDevice.controls).toEqual({ on: null, brightness: 50 });
            expect(mockDevice.measurements).toEqual({ power: null });
        });

        it('should keep the values the device already has', async () => {
            mockDevice.controls = { on: true };
            mockDeviceConfigsValidator.buildDefaultPayloads.mockResolvedValue({
                controls: { on: null, brightness: 50 },
                measurements: {},
            });

            await service.applyConfigDefaults();

            expect(mockDevice.controls).toEqual({ on: true, brightness: 50 });
        });
    });

    describe('validateCommand', () => {
        it('should validate the command against the device config and the controls dto', async () => {
            const command = { on: true };

            await expect(service.validateCommand(command)).resolves.toEqual(command);
            expect(mockDeviceConfigsValidator.validateSection).toHaveBeenCalledWith(mockDevice, 'commands', command, 'reject');
        });

        it('should throw when the controls dto rejects the command', async () => {
            await expect(service.validateCommand({ on: 'yes' })).rejects.toThrow(CustomValidationException);
        });
    });

    describe('setControls', () => {
        it('should send the payload via the resolver using the device transport protocol', async () => {
            const payload: TransportMessage = { method: 'POST', url: 'http://device/rpc', payload: { on: true } };
            service.payload = payload;

            await service.setControls({ on: true } as DeviceControls);

            expect(mockResolver.send).toHaveBeenCalledWith(TransportProtocol.Http, payload);
        });

        it('should not send anything when the payload is null', async () => {
            service.payload = null;

            await service.setControls({ on: true } as DeviceControls);

            expect(mockResolver.send).not.toHaveBeenCalled();
        });

        it('should swallow errors thrown while building the payload', async () => {
            service.payloadError = new Error('boom');

            await expect(service.setControls({ on: true } as DeviceControls)).resolves.toBeUndefined();
            expect(mockResolver.send).not.toHaveBeenCalled();
            expect(logErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to set controls'));
        });

        it('should swallow errors thrown by the transport resolver', async () => {
            service.payload = { method: 'GET', url: 'http://device' };
            mockResolver.send.mockRejectedValue(new Error('transport failed'));

            await expect(service.setControls({ on: true } as DeviceControls)).resolves.toBeUndefined();
            expect(logErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to set controls'));
        });

        it('should map the message payload names using the device config before sending', async () => {
            service.payload = { method: 'POST', url: 'http://device/rpc', payload: { on: true } };
            mockDeviceConfigsMapper.mapPayloadToDevice.mockResolvedValue({ state: 'ON' });

            await service.setControls({ on: true } as DeviceControls);

            expect(mockDeviceConfigsMapper.mapPayloadToDevice).toHaveBeenCalledWith(mockDevice, { on: true });
            expect(mockResolver.send).toHaveBeenCalledWith(TransportProtocol.Http, {
                method: 'POST',
                url: 'http://device/rpc',
                payload: { state: 'ON' },
            });
        });

        it('should not send the controls that are still seeded with null', async () => {
            service.payload = { method: 'POST', url: 'http://device/rpc', payload: { on: true } };

            await service.setControls({ on: true, brightness: null, color: undefined } as DeviceControls);

            expect(mockDeviceConfigsMapper.mapPayloadToDevice).toHaveBeenCalledWith(mockDevice, { on: true });
        });

        it('should not map anything when the message has no payload', async () => {
            service.payload = { method: 'GET', url: 'http://device' };

            await service.setControls({ on: true } as DeviceControls);

            expect(mockDeviceConfigsMapper.mapPayloadToDevice).not.toHaveBeenCalled();
            expect(mockResolver.send).toHaveBeenCalledWith(TransportProtocol.Http, { method: 'GET', url: 'http://device' });
        });
    });
});
