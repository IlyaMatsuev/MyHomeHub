// The uuid package ships as ESM only, which jest does not transform - the externalId default is irrelevant for these tests
jest.mock('uuid', () => ({ v4: () => 'device-uuid-123' }));

import { model, Types } from 'mongoose';
import { DeviceSchema } from 'devices/schemas/device.schema';
import { Device, DeviceBrand, DeviceType, Room } from 'devices/interfaces';
import { TransportProtocol } from 'devices-control/interfaces';

// The per-field behaviour of the pre-validate hook is covered by device.validators.spec.ts,
// these cases check that the hook is wired into the schema and plays well with the field validators
describe('DeviceSchema', () => {
    const DeviceModel = model<Device>('SchemaSpecDevice', DeviceSchema);

    const hydrateZigbeeDevice = (): Device =>
        DeviceModel.hydrate({
            _id: new Types.ObjectId(),
            externalId: 'device-uuid-123',
            name: 'Main ceiling light (bulb)',
            type: DeviceType.LED,
            brand: DeviceBrand.Philips,
            room: Room.LivingRoom,
            transportProtocol: TransportProtocol.Zigbee,
            zigbeeIeeeAddress: '0x001788010ec41169',
            zigbeeFriendlyName: 'LivingRoomMainLight',
            controls: {},
        });

    it('should drop the zigbee fields when the device moves to another transport protocol', async () => {
        const device = hydrateZigbeeDevice();

        device.brand = DeviceBrand.Shelly;
        device.transportProtocol = TransportProtocol.Http;
        device.ip = '192.168.0.17';

        await expect(device.validate()).resolves.toBeUndefined();
        expect(device.zigbeeIeeeAddress).toBeUndefined();
        expect(device.zigbeeFriendlyName).toBeUndefined();
        expect(device.getChanges()).toEqual(expect.objectContaining({ $unset: { zigbeeIeeeAddress: 1, zigbeeFriendlyName: 1 } }));
    });

    it('should keep the zigbee fields when the device stays on the zigbee protocol', async () => {
        const device = hydrateZigbeeDevice();

        device.room = Room.Bedroom;

        await expect(device.validate()).resolves.toBeUndefined();
        expect(device.zigbeeIeeeAddress).toBe('0x001788010ec41169');
        expect(device.zigbeeFriendlyName).toBe('LivingRoomMainLight');
    });

    it('should reject a zigbee field written explicitly to a non-zigbee device', async () => {
        const device = hydrateZigbeeDevice();

        device.transportProtocol = TransportProtocol.Http;
        device.zigbeeFriendlyName = 'NewName';

        await expect(device.validate()).rejects.toThrow(/Zigbee friendly name/);
    });

    it('should reject a new device created with fields of another brand', async () => {
        const device = new DeviceModel({
            name: 'Bedroom plug',
            type: DeviceType.Plug,
            brand: DeviceBrand.Shelly,
            transportProtocol: TransportProtocol.Http,
            tuyaDeviceId: 'tuya-device-id',
        });

        await expect(device.validate()).rejects.toThrow(/Tuya device id/);
    });
});
