import { DevicesControlServiceFactory } from './devices-control-service.factory';
import { DeviceControlServiceFactory } from './interfaces';
import { DevicesControlService } from './devices-control.service';
import { Device, DeviceBrand, DeviceType, Room } from 'devices/interfaces';

describe('DevicesControlServiceFactory', () => {
    let factory: DevicesControlServiceFactory;
    let mockControlServiceFactory1: jest.Mocked<DeviceControlServiceFactory>;
    let mockControlServiceFactory2: jest.Mocked<DeviceControlServiceFactory>;
    let mockControlService: jest.Mocked<DevicesControlService>;

    const mockDevice: Partial<Device> = {
        externalId: 'device-uuid-123',
        name: 'Test Device',
        type: DeviceType.LED,
        brand: DeviceBrand.Tuya,
        room: Room.LivingRoom,
    };

    beforeEach(() => {
        mockControlService = {} as jest.Mocked<DevicesControlService>;

        mockControlServiceFactory1 = {
            eligible: jest.fn(),
            createService: jest.fn(),
        };
        mockControlServiceFactory2 = {
            eligible: jest.fn(),
            createService: jest.fn(),
        };

        factory = new DevicesControlServiceFactory([mockControlServiceFactory1, mockControlServiceFactory2]);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getControlService', () => {
        it('should return control service from first eligible factory', () => {
            mockControlServiceFactory1.eligible.mockReturnValue(true);
            mockControlServiceFactory1.createService.mockReturnValue(mockControlService);

            const result = factory.getControlService(mockDevice as Device);

            expect(result).toBe(mockControlService);
            expect(mockControlServiceFactory1.eligible).toHaveBeenCalledWith(mockDevice);
            expect(mockControlServiceFactory1.createService).toHaveBeenCalledWith(mockDevice);
            expect(mockControlServiceFactory2.eligible).not.toHaveBeenCalled();
        });

        it('should try next factory when first is not eligible', () => {
            mockControlServiceFactory1.eligible.mockReturnValue(false);
            mockControlServiceFactory2.eligible.mockReturnValue(true);
            mockControlServiceFactory2.createService.mockReturnValue(mockControlService);

            const result = factory.getControlService(mockDevice as Device);

            expect(result).toBe(mockControlService);
            expect(mockControlServiceFactory1.eligible).toHaveBeenCalledWith(mockDevice);
            expect(mockControlServiceFactory1.createService).not.toHaveBeenCalled();
            expect(mockControlServiceFactory2.eligible).toHaveBeenCalledWith(mockDevice);
            expect(mockControlServiceFactory2.createService).toHaveBeenCalledWith(mockDevice);
        });

        it('should throw error when no eligible factory found', () => {
            mockControlServiceFactory1.eligible.mockReturnValue(false);
            mockControlServiceFactory2.eligible.mockReturnValue(false);

            expect(() => factory.getControlService(mockDevice as Device)).toThrow(
                `The device of type "${mockDevice.type}" does not have an implementation of a device control service yet`,
            );
        });
    });
});
