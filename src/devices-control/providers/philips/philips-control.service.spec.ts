import { ConfigService } from '@nestjs/config';
import { Device, DeviceBrand, DeviceType, Room } from 'devices/interfaces';
import { PhilipsControlService } from './philips-control.service';
import { DeviceTransportServiceResolver } from 'devices-control/transport';
import { TransportProtocol } from 'devices-control/interfaces';
import { DeviceConfigsMapperService } from 'device-configs/device-configs-mapper.service';
import { DeviceConfigsValidatorService } from 'device-configs/device-configs-validator.service';

describe('PhilipsControlService', () => {
    let service: PhilipsControlService;
    let mockResolver: { send: jest.Mock };

    const mockDevice: Partial<Device> = {
        externalId: 'device-uuid-123',
        name: 'Philips Bulb',
        type: DeviceType.LED,
        brand: DeviceBrand.Philips,
        transportProtocol: TransportProtocol.Zigbee,
        zigbeeFriendlyName: 'living_room_bulb',
        zigbeeIeeeAddress: '0x00158d0001234567',
        room: Room.LivingRoom,
        controls: { on: false },
    };

    beforeEach(() => {
        mockResolver = { send: jest.fn().mockResolvedValue(undefined) };
        service = new PhilipsControlService(
            mockDevice as Device,
            mockResolver as unknown as DeviceTransportServiceResolver,
            {} as ConfigService,
            { mapPayloadToDevice: jest.fn((_key, payload) => Promise.resolve(payload)) } as unknown as DeviceConfigsMapperService,
            {
                validateSection: jest.fn((_key, _section, payload) => Promise.resolve(payload)),
            } as unknown as DeviceConfigsValidatorService,
        );
        jest.spyOn(service['logger'], 'log').mockImplementation();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('setControls', () => {
        it('should not send anything since Philips control is not implemented yet', async () => {
            await service.setControls({ on: true });

            expect(mockResolver.send).not.toHaveBeenCalled();
        });
    });
});
