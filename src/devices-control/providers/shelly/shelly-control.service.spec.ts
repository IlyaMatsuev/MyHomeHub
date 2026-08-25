import { ConfigService } from '@nestjs/config';
import { Device, DeviceBrand, DeviceType, Room } from 'devices/interfaces';
import { ShellyControlService } from './shelly-control.service';
import { ShellyLedControlService } from './led';
import { DeviceTransportServiceResolver } from 'devices-control/transport';
import { HttpMessage, TransportProtocol } from 'devices-control/interfaces';
import { DeviceConfigsMapperService } from 'device-configs/device-configs-mapper.service';
import { DeviceConfigsValidatorService } from 'device-configs/device-configs-validator.service';

describe('ShellyControlService', () => {
    let mockResolver: { send: jest.Mock; receive: jest.Mock };
    let mockDeviceConfigsMapper: { mapPayloadToDevice: jest.Mock; mapPayloadFromDevice: jest.Mock };

    const mockPlug: Partial<Device> = {
        externalId: 'device-uuid-123',
        name: 'Shelly Plug',
        type: DeviceType.Plug,
        brand: DeviceBrand.Shelly,
        transportProtocol: TransportProtocol.Http,
        room: Room.Kitchen,
        ip: '192.168.1.10',
        controls: { on: false },
        measurements: { power: null },
    };

    const mockLed: Partial<Device> = { ...mockPlug, type: DeviceType.LED };

    // https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch#switchgetstatus-example
    const switchStatus = {
        id: 0,
        source: 'init',
        output: true,
        apower: 4.5,
        voltage: 238.7,
        current: 0.029,
        aenergy: { total: 14.982, by_minute: [0, 0, 0] },
        temperature: { tC: 42.1, tF: 107.8 },
    };

    const createService = (device: Partial<Device>, ledService = false) => {
        const args = [
            device as Device,
            mockResolver as unknown as DeviceTransportServiceResolver,
            {} as ConfigService,
            mockDeviceConfigsMapper as unknown as DeviceConfigsMapperService,
            { validateSection: jest.fn((_key, _section, payload) => Promise.resolve(payload)) } as unknown as DeviceConfigsValidatorService,
        ] as const;
        return ledService ? new ShellyLedControlService(...args) : new ShellyControlService(...args);
    };

    beforeEach(() => {
        mockResolver = {
            send: jest.fn().mockResolvedValue(undefined),
            receive: jest.fn().mockResolvedValue({ id: 1, src: 'shellyplus-a1b2c3', result: switchStatus }),
        };
        mockDeviceConfigsMapper = {
            mapPayloadToDevice: jest.fn((_key, payload) => Promise.resolve(payload)),
            mapPayloadFromDevice: jest.fn((_key, _section, payload) => Promise.resolve(payload)),
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getState', () => {
        it('should read the status of the switch component of a plug', async () => {
            await createService(mockPlug).getState();

            expect(mockResolver.receive).toHaveBeenCalledWith(TransportProtocol.Http, {
                url: 'http://192.168.1.10/rpc',
                method: 'POST',
                payload: { id: 1, method: 'Switch.GetStatus', params: { id: 0 } },
            });
        });

        it('should read the status of the RGBCCT component of a LED', async () => {
            await createService(mockLed, true).getState();

            const message = mockResolver.receive.mock.calls[0][1] as HttpMessage;
            expect(message.payload.method).toBe('RGBCCT.GetStatus');
        });

        it('should split the reported status into controls and measurements', async () => {
            const state = await createService(mockPlug).getState();

            expect(state.controls).toEqual({ on: true });
            expect(state.measurements).toEqual({ id: 0, source: 'init', apower: 4.5, voltage: 238.7, current: 0.029 });
        });

        it('should skip the nested status objects, so only the scalar readings are reported', async () => {
            const state = await createService(mockPlug).getState();

            expect(state.measurements).not.toHaveProperty('aenergy');
            expect(state.measurements).not.toHaveProperty('temperature');
        });

        it('should read the LED controls from their Shelly status fields', async () => {
            mockResolver.receive.mockResolvedValue({
                result: {
                    id: 0,
                    output: true,
                    mode: 'rgb',
                    brightness: 75,
                    rgb: [255, 0, 128],
                    ct: 3400,
                    apower: 8.1,
                    temperature: { tC: 42.1, tF: 107.8 },
                },
            });

            const state = await createService(mockLed, true).getState();

            expect(state.controls).toEqual({ on: true, mode: 'rgb', brightness: 75, color: '#ff0080', temperature: 3400 });
            expect(state.measurements).toEqual({ id: 0, apower: 8.1 });
        });

        it('should skip the controls the device does not report', async () => {
            mockResolver.receive.mockResolvedValue({ result: { output: false, mode: null } });

            const state = await createService(mockLed, true).getState();

            expect(state.controls).toEqual({ on: false });
        });

        it('should translate the status names through the device config', async () => {
            mockDeviceConfigsMapper.mapPayloadFromDevice.mockImplementation((_key, section, payload) => {
                return Promise.resolve(section === 'measurements' ? { power: payload.apower } : payload);
            });

            const state = await createService(mockPlug).getState();

            expect(state.measurements).toEqual({ power: 4.5 });
            expect(mockDeviceConfigsMapper.mapPayloadFromDevice).toHaveBeenCalledWith(
                mockPlug,
                'controls',
                expect.objectContaining({ on: true }),
            );
        });

        it('should throw when the device does not return a status result', async () => {
            mockResolver.receive.mockResolvedValue({ id: 1, error: 'Method not found' });

            await expect(createService(mockPlug).getState()).rejects.toThrow('returned an unexpected status');
        });

        it('should throw when the device has no IP address to be polled at', async () => {
            await expect(createService({ ...mockPlug, ip: undefined }).getState()).rejects.toThrow('does not have an IP address');
        });
    });

    describe('setControls', () => {
        it('should set the controls on the switch component of a plug', async () => {
            await createService(mockPlug).setControls({ on: true });

            expect(mockResolver.send).toHaveBeenCalledWith(TransportProtocol.Http, {
                url: 'http://192.168.1.10/rpc',
                method: 'POST',
                payload: { id: 1, method: 'Switch.Set', params: { id: 0, on: true } },
            });
        });

        it('should translate the LED controls into the Shelly RPC params', async () => {
            await createService(mockLed, true).setControls({ on: true, brightness: 75, color: '#ff0080', temperature: 3400 });

            const message = mockResolver.send.mock.calls[0][1] as HttpMessage;
            expect(message.payload).toEqual({
                id: 1,
                method: 'RGBCCT.Set',
                params: { id: 0, on: true, brightness: 75, rgb: [255, 0, 128], ct: 3400 },
            });
        });

        it('should not send anything when no component supports all the requested controls', async () => {
            const service = createService(mockPlug);
            jest.spyOn(service['logger'], 'error').mockImplementation();

            await service.setControls({ on: true, brightness: 75 });

            expect(mockResolver.send).not.toHaveBeenCalled();
        });
    });
});
