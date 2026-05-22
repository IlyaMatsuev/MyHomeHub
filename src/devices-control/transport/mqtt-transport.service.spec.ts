import { MqttService } from 'mqtt/mqtt.service';
import { MqttTransportService } from './mqtt-transport.service';
import { MqttMessage, TransportProtocol } from 'devices-control/interfaces';

describe('MqttTransportService', () => {
    let service: MqttTransportService;
    let mockMqttService: { publish: jest.Mock };

    beforeEach(() => {
        mockMqttService = { publish: jest.fn() };
        service = new MqttTransportService(mockMqttService as unknown as MqttService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should expose the mqtt protocol', () => {
        expect(service.protocol).toBe(TransportProtocol.Mqtt);
    });

    describe('send', () => {
        it('should publish topic, payload and spread topic params', async () => {
            const message: MqttMessage = {
                topic: 'devices/controls',
                topicParams: ['device-uuid'],
                payload: { on: true },
            };

            await service.send(message);

            expect(mockMqttService.publish).toHaveBeenCalledWith('devices/controls', { on: true }, 'device-uuid');
        });

        it('should publish without params when topicParams is omitted', async () => {
            const message: MqttMessage = { topic: 'devices/controls', payload: { on: false } };

            await service.send(message);

            expect(mockMqttService.publish).toHaveBeenCalledWith('devices/controls', { on: false });
        });
    });
});
