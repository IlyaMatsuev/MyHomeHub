import { dropScopedDependencyFields, isTuyaDevice, isZigbeeDevice, ScopedDevice } from 'devices/schemas/device.validators';
import { DeviceBrand } from 'devices/interfaces';
import { TransportProtocol } from 'devices-control/interfaces';

describe('DeviceValidators', () => {
    // The hook is called by mongoose with the document as "this"
    type MockDocument = Record<string, unknown> & { isDirectModified: jest.Mock };

    const createDocument = (fields: Record<string, unknown>, directlyModifiedFields: Array<string> = []): MockDocument => ({
        ...fields,
        isDirectModified: jest.fn((field: string) => directlyModifiedFields.includes(field)),
    });

    const dropFieldsOf = (document: object, next = jest.fn()) => {
        dropScopedDependencyFields.call(document, next);
        return next;
    };

    describe('isTuyaDevice', () => {
        it('should return true for a device of the tuya brand', () => {
            expect(isTuyaDevice({ brand: DeviceBrand.Tuya })).toBe(true);
        });

        it('should return false for a device of another brand', () => {
            expect(isTuyaDevice({ brand: DeviceBrand.Shelly })).toBe(false);
        });

        it('should return false for a device without a brand', () => {
            expect(isTuyaDevice({} as ScopedDevice)).toBe(false);
        });
    });

    describe('isZigbeeDevice', () => {
        it('should return true for a device on the zigbee protocol', () => {
            expect(isZigbeeDevice({ transportProtocol: TransportProtocol.Zigbee })).toBe(true);
        });

        it('should return false for a device on another protocol', () => {
            expect(isZigbeeDevice({ transportProtocol: TransportProtocol.Http })).toBe(false);
        });

        it('should return false for a device without a transport protocol', () => {
            expect(isZigbeeDevice({} as ScopedDevice)).toBe(false);
        });
    });

    describe('dropScopedDependencyFields', () => {
        it('should drop the zigbee fields of a device that is no longer on the zigbee protocol', () => {
            const document = createDocument({
                brand: DeviceBrand.Shelly,
                transportProtocol: TransportProtocol.Http,
                zigbeeIeeeAddress: '0x001788010ec41169',
                zigbeeFriendlyName: 'LivingRoomMainLight',
            });

            dropFieldsOf(document);

            expect(document.zigbeeIeeeAddress).toBeUndefined();
            expect(document.zigbeeFriendlyName).toBeUndefined();
        });

        it('should keep the zigbee fields of a device that stays on the zigbee protocol', () => {
            const document = createDocument({
                brand: DeviceBrand.Philips,
                transportProtocol: TransportProtocol.Zigbee,
                zigbeeIeeeAddress: '0x001788010ec41169',
                zigbeeFriendlyName: 'LivingRoomMainLight',
            });

            dropFieldsOf(document);

            expect(document.zigbeeIeeeAddress).toBe('0x001788010ec41169');
            expect(document.zigbeeFriendlyName).toBe('LivingRoomMainLight');
        });

        it('should drop the tuya fields of a device that is no longer of the tuya brand', () => {
            const document = createDocument({
                brand: DeviceBrand.Shelly,
                transportProtocol: TransportProtocol.Http,
                tuyaDeviceId: 'tuya-device-id',
                tuyaDeviceLocalKey: 'tuya-local-key',
            });

            dropFieldsOf(document);

            expect(document.tuyaDeviceId).toBeUndefined();
            expect(document.tuyaDeviceLocalKey).toBeUndefined();
        });

        it('should keep the tuya fields of a device that stays of the tuya brand', () => {
            const document = createDocument({
                brand: DeviceBrand.Tuya,
                transportProtocol: TransportProtocol.Tuya,
                tuyaDeviceId: 'tuya-device-id',
                tuyaDeviceLocalKey: 'tuya-local-key',
            });

            dropFieldsOf(document);

            expect(document.tuyaDeviceId).toBe('tuya-device-id');
            expect(document.tuyaDeviceLocalKey).toBe('tuya-local-key');
        });

        it('should keep an inapplicable field that has been written explicitly, so that it fails the validation', () => {
            const document = createDocument(
                {
                    brand: DeviceBrand.Shelly,
                    transportProtocol: TransportProtocol.Http,
                    zigbeeIeeeAddress: '0x001788010ec41169',
                    zigbeeFriendlyName: 'NewName',
                },
                ['zigbeeFriendlyName'],
            );

            dropFieldsOf(document);

            expect(document.zigbeeFriendlyName).toBe('NewName');
            expect(document.zigbeeIeeeAddress).toBeUndefined();
        });

        it('should not touch the fields that are not set on the device', () => {
            const document = createDocument({ brand: DeviceBrand.Shelly, transportProtocol: TransportProtocol.Http });

            dropFieldsOf(document);

            expect(document.isDirectModified).not.toHaveBeenCalled();
            expect(Object.keys(document)).toEqual(['brand', 'transportProtocol', 'isDirectModified']);
        });

        it('should call the next hook callback once', () => {
            const document = createDocument({ brand: DeviceBrand.Tuya, transportProtocol: TransportProtocol.Tuya });

            const next = dropFieldsOf(document);

            expect(next).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledWith();
        });
    });
});
