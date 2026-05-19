import { Test, TestingModule } from '@nestjs/testing';
import { MqttService } from './mqtt.service';
import { CONTROLS_UPDATE_TOPIC_NAME, DEVICE_PAIR_REPLY_TOPIC_NAME, MQTT_CLIENT_PROVIDER_NAME } from './mqtt.constants';
import { PairAcceptDto } from './dto';

describe('MqttService', () => {
    let service: MqttService;
    let mockClient: { emit: jest.Mock };

    beforeEach(async () => {
        mockClient = { emit: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MqttService,
                {
                    provide: MQTT_CLIENT_PROVIDER_NAME,
                    useValue: mockClient,
                },
            ],
        }).compile();

        service = module.get<MqttService>(MqttService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('publish', () => {
        it('should emit payload to the given topic when no wildcard params are passed', () => {
            const payload = { hello: 'world' };

            service.publish(DEVICE_PAIR_REPLY_TOPIC_NAME, payload);

            expect(mockClient.emit).toHaveBeenCalledWith(DEVICE_PAIR_REPLY_TOPIC_NAME, payload);
        });

        it('should substitute wildcard segments with the provided params', () => {
            const controls = { on: true, brightness: 50 };

            service.publish(CONTROLS_UPDATE_TOPIC_NAME, controls, 'device-uuid-123');

            expect(mockClient.emit).toHaveBeenCalledWith('home/devices/device-uuid-123/controls/update', controls);
        });

        it('should substitute multiple wildcard segments in order', () => {
            const topic = 'home/+/devices/+/state';

            service.publish(topic, { value: 1 }, 'living-room', 'device-uuid');

            expect(mockClient.emit).toHaveBeenCalledWith('home/living-room/devices/device-uuid/state', { value: 1 });
        });
    });

    describe('extractTopicWildcards', () => {
        it('should return the values that matched wildcards', () => {
            const result = service.extractTopicWildcards(CONTROLS_UPDATE_TOPIC_NAME, 'home/devices/device-uuid-123/controls/update');

            expect(result).toEqual(['device-uuid-123']);
        });

        it('should return values for multiple wildcards in order', () => {
            const result = service.extractTopicWildcards('home/+/devices/+/state', 'home/living-room/devices/device-uuid/state');

            expect(result).toEqual(['living-room', 'device-uuid']);
        });

        it('should return an empty array when the pattern has no wildcards', () => {
            const result = service.extractTopicWildcards(DEVICE_PAIR_REPLY_TOPIC_NAME, DEVICE_PAIR_REPLY_TOPIC_NAME);

            expect(result).toEqual([]);
        });
    });
});

describe('PairAcceptDto', () => {
    describe('accept', () => {
        it('should create accept response with device details', () => {
            const result = PairAcceptDto.accept('device-id', { on: true }, 3000);

            expect(result).toEqual({
                accepted: true,
                deviceId: 'device-id',
                controls: { on: true },
                updateInterval: 3000,
            });
        });
    });

    describe('reject', () => {
        it('should create rejection response with error message', () => {
            const result = PairAcceptDto.reject('Error message');

            expect(result).toEqual({
                accepted: false,
                message: 'Error message',
            });
        });
    });
});
