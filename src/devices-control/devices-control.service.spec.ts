import { ConfigService } from '@nestjs/config';
import { ClassConstructor } from 'class-transformer/types/interfaces';
import { DevicesControlService } from './devices-control.service';
import { DeviceTransportServiceResolver } from 'devices-control/transport';
import { TransportMessage, TransportProtocol } from 'devices-control/interfaces';
import { Device, DeviceControls } from 'devices/interfaces';

class TestControlsDto {
    on?: boolean;
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

describe('DevicesControlService', () => {
    let service: TestControlService;
    let mockResolver: { send: jest.Mock };
    let logErrorSpy: jest.SpyInstance;

    const mockDevice: Partial<Device> = {
        externalId: 'device-uuid-123',
        transportProtocol: TransportProtocol.Http,
    };

    beforeEach(() => {
        mockResolver = { send: jest.fn().mockResolvedValue(undefined) };
        service = new TestControlService(
            mockDevice as Device,
            mockResolver as unknown as DeviceTransportServiceResolver,
            {} as ConfigService,
        );
        logErrorSpy = jest.spyOn(service['logger'], 'error').mockImplementation();
        jest.spyOn(service['logger'], 'log').mockImplementation();
    });

    afterEach(() => {
        jest.clearAllMocks();
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
    });
});
