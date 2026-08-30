import { DeviceTransportServiceResolver } from './device-transport-service.resolver';
import { DeviceTransportService, TransportMessage, TransportProtocol } from 'devices-control/interfaces';

describe('DeviceTransportServiceResolver', () => {
    let resolver: DeviceTransportServiceResolver;
    let mockHttpTransport: jest.Mocked<DeviceTransportService>;
    let mockMqttTransport: jest.Mocked<DeviceTransportService>;

    beforeEach(() => {
        mockHttpTransport = {
            protocol: TransportProtocol.Http,
            send: jest.fn().mockResolvedValue(undefined),
            receive: jest.fn().mockResolvedValue({ result: { output: true } }),
        };
        mockMqttTransport = {
            protocol: TransportProtocol.Mqtt,
            send: jest.fn().mockResolvedValue(undefined),
        };

        resolver = new DeviceTransportServiceResolver([mockHttpTransport, mockMqttTransport]);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('send', () => {
        it('should delegate to the transport matching the protocol', async () => {
            const message: TransportMessage = { method: 'POST', url: 'http://device/rpc', payload: { on: true } };

            await resolver.send(TransportProtocol.Http, message);

            expect(mockHttpTransport.send).toHaveBeenCalledWith(message);
            expect(mockMqttTransport.send).not.toHaveBeenCalled();
        });

        it('should select the transport by protocol when multiple are registered', async () => {
            const message: TransportMessage = { topic: 'devices/update', payload: { on: false } };

            await resolver.send(TransportProtocol.Mqtt, message);

            expect(mockMqttTransport.send).toHaveBeenCalledWith(message);
            expect(mockHttpTransport.send).not.toHaveBeenCalled();
        });

        it('should throw when no transport is registered for the protocol', () => {
            const message: TransportMessage = { payload: {} };

            expect(() => resolver.send(TransportProtocol.Zigbee, message)).toThrow(
                `No transport service registered for protocol "${TransportProtocol.Zigbee}"`,
            );
        });
    });

    describe('receive', () => {
        it('should return the response of the transport matching the protocol', async () => {
            const message: TransportMessage = { method: 'POST', url: 'http://device/rpc', payload: { id: 1 } };

            const result = await resolver.receive(TransportProtocol.Http, message);

            expect(result).toEqual({ result: { output: true } });
            expect(mockHttpTransport.receive).toHaveBeenCalledWith(message);
        });

        it('should throw when no transport is registered for the protocol', () => {
            expect(() => resolver.receive(TransportProtocol.Zigbee, { payload: {} })).toThrow(
                `No transport service registered for protocol "${TransportProtocol.Zigbee}"`,
            );
        });

        it('should throw when the transport cannot read a device state', () => {
            expect(() => resolver.receive(TransportProtocol.Mqtt, { topic: 'devices/update' })).toThrow(
                `Transport service for protocol "${TransportProtocol.Mqtt}" cannot read a device state`,
            );
        });
    });
});
