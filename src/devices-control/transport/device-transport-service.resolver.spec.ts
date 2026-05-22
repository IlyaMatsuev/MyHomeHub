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
});
