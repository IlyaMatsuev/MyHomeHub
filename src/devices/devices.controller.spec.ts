import { Test, TestingModule } from '@nestjs/testing';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { Device, DeviceBrand, DeviceType, Room } from './interfaces';
import { CreateDeviceDto, GetDevicesDto, GetPairableDevicesDto, ToggleDevicesPairingModeDto, UpdateDeviceDto } from './dto';

describe('DevicesController', () => {
    let controller: DevicesController;
    let mockDevicesService: {
        getDevices: jest.Mock;
        getDeviceByExternalId: jest.Mock;
        addDevice: jest.Mock;
        updateDevice: jest.Mock;
        sendCommand: jest.Mock;
        removeDevice: jest.Mock;
        getPairableDevices: jest.Mock;
        toggleDevicePairingMode: jest.Mock;
    };

    const mockDevice: Partial<Device> = {
        _id: 'mongo-id-123',
        externalId: 'device-uuid-123',
        name: 'Test Device',
        type: DeviceType.LED,
        brand: DeviceBrand.Tuya,
        room: Room.LivingRoom,
        controls: { on: false },
    };

    beforeEach(async () => {
        mockDevicesService = {
            getDevices: jest.fn(),
            getDeviceByExternalId: jest.fn(),
            addDevice: jest.fn(),
            updateDevice: jest.fn(),
            sendCommand: jest.fn(),
            removeDevice: jest.fn(),
            getPairableDevices: jest.fn(),
            toggleDevicePairingMode: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [DevicesController],
            providers: [
                {
                    provide: DevicesService,
                    useValue: mockDevicesService,
                },
            ],
        }).compile();

        controller = module.get<DevicesController>(DevicesController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getDevices', () => {
        it('should return paginated devices', async () => {
            const devicesPage = {
                devices: [mockDevice],
                page: 1,
                pageSize: 10,
                totalPages: 1,
            };
            mockDevicesService.getDevices.mockResolvedValue(devicesPage);

            const query = new GetDevicesDto();
            const result = await controller.getDevices(query);

            expect(result).toEqual(devicesPage);
            expect(mockDevicesService.getDevices).toHaveBeenCalledWith({}, query);
        });
    });

    describe('getDevice', () => {
        it('should return device by external ID', async () => {
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(mockDevice);

            const result = await controller.getDevice('device-uuid-123');

            expect(result).toEqual(mockDevice);
            expect(mockDevicesService.getDeviceByExternalId).toHaveBeenCalledWith('device-uuid-123');
        });
    });

    describe('addDevice', () => {
        it('should create and return new device', async () => {
            mockDevicesService.addDevice.mockResolvedValue(mockDevice);

            const createDto: CreateDeviceDto = {
                name: 'Test Device',
                type: DeviceType.LED,
                brand: DeviceBrand.Tuya,
                room: Room.LivingRoom,
            } as CreateDeviceDto;

            const result = await controller.addDevice(createDto);

            expect(result).toEqual(mockDevice);
            expect(mockDevicesService.addDevice).toHaveBeenCalledWith(createDto);
        });
    });

    describe('updateDevice', () => {
        it('should update and return device', async () => {
            const updatedDevice = { ...mockDevice, name: 'Updated Device' };
            mockDevicesService.updateDevice.mockResolvedValue(updatedDevice);

            const updateDto = new UpdateDeviceDto({ name: 'Updated Device' });
            const result = await controller.updateDevice('device-uuid-123', updateDto);

            expect(result).toEqual(updatedDevice);
            expect(mockDevicesService.updateDevice).toHaveBeenCalledWith('device-uuid-123', updateDto);
        });
    });

    describe('sendCommand', () => {
        it('should send command and return the validated command', async () => {
            const command = { action: 'on_press' };
            mockDevicesService.sendCommand.mockResolvedValue(command);

            const result = await controller.sendCommand('device-uuid-123', command);

            expect(result).toEqual(command);
            expect(mockDevicesService.sendCommand).toHaveBeenCalledWith('device-uuid-123', command);
        });
    });

    describe('removeDevice', () => {
        it('should delete and return device', async () => {
            mockDevicesService.removeDevice.mockResolvedValue(mockDevice);

            const result = await controller.removeDevice('device-uuid-123');

            expect(result).toEqual(mockDevice);
            expect(mockDevicesService.removeDevice).toHaveBeenCalledWith('device-uuid-123');
        });
    });

    describe('getPairableDevices', () => {
        it('should return paginated pairable devices', async () => {
            const pairablePage = {
                devices: [{ zigbeeIeeeAddress: '0x001', zigbeeFriendlyName: 'bulb_a' }],
                page: 1,
                pageSize: 10,
                totalPages: 1,
            };
            mockDevicesService.getPairableDevices.mockResolvedValue(pairablePage);

            const options = new GetPairableDevicesDto();
            const result = await controller.getPairableDevices(options);

            expect(result).toEqual(pairablePage);
            expect(mockDevicesService.getPairableDevices).toHaveBeenCalledWith(options);
        });
    });

    describe('toggleDevicesPairingMode', () => {
        it('should enable pairing mode with provided seconds', async () => {
            const status = { enabled: true, timeout: 60 };
            mockDevicesService.toggleDevicePairingMode.mockResolvedValue(status);

            const dto: ToggleDevicesPairingModeDto = { enable: true, seconds: 60 };
            const result = await controller.toggleDevicesPairingMode(dto);

            expect(result).toEqual(status);
            expect(mockDevicesService.toggleDevicePairingMode).toHaveBeenCalledWith(true, 60);
        });

        it('should disable pairing mode', async () => {
            const status = { enabled: false, timeout: 0 };
            mockDevicesService.toggleDevicePairingMode.mockResolvedValue(status);

            const dto: ToggleDevicesPairingModeDto = { enable: false, seconds: 60 };
            const result = await controller.toggleDevicesPairingMode(dto);

            expect(result).toEqual(status);
            expect(mockDevicesService.toggleDevicePairingMode).toHaveBeenCalledWith(false, 60);
        });
    });
});
