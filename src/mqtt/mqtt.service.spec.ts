import { Test, TestingModule } from '@nestjs/testing';
import { MqttService } from './mqtt.service';
import { MQTT_CLIENT_PROVIDER_NAME } from './mqtt.constants';

// Generic topics used to exercise the topic-mechanics of MqttService.
const NO_WILDCARD_TOPIC = 'home/devices/pair/reply';
const SINGLE_WILDCARD_TOPIC = 'home/devices/+/controls/update';

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

            service.publish(NO_WILDCARD_TOPIC, payload);

            expect(mockClient.emit).toHaveBeenCalledWith(NO_WILDCARD_TOPIC, payload);
        });

        it('should substitute wildcard segments with the provided params', () => {
            const controls = { on: true, brightness: 50 };

            service.publish(SINGLE_WILDCARD_TOPIC, controls, 'device-uuid-123');

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
            const result = service.extractTopicWildcards(SINGLE_WILDCARD_TOPIC, 'home/devices/device-uuid-123/controls/update');

            expect(result).toEqual(['device-uuid-123']);
        });

        it('should return values for multiple wildcards in order', () => {
            const result = service.extractTopicWildcards('home/+/devices/+/state', 'home/living-room/devices/device-uuid/state');

            expect(result).toEqual(['living-room', 'device-uuid']);
        });

        it('should return an empty array when the pattern has no wildcards', () => {
            const result = service.extractTopicWildcards(NO_WILDCARD_TOPIC, NO_WILDCARD_TOPIC);

            expect(result).toEqual([]);
        });
    });
});
