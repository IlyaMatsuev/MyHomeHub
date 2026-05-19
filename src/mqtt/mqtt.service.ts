import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { MQTT_CLIENT_PROVIDER_NAME, MQTT_TOPIC_PARTS_SEPARATOR, MQTT_TOPIC_PARTS_WILDCARD } from 'mqtt/mqtt.constants';

@Injectable()
export class MqttService {
    constructor(@Inject(MQTT_CLIENT_PROVIDER_NAME) private readonly client: ClientProxy) {}

    publish<T>(topic: string, payload: T, ...params: Array<string>): void {
        const completeTopic = (params || []).reduce((t, param) => t.replace('+', param), topic);
        this.client.emit(completeTopic, payload);
    }

    extractTopicWildcards(topicPattern: string, topic: string): Array<string> {
        const patternTopicParts = topicPattern.split(MQTT_TOPIC_PARTS_SEPARATOR);
        const topicParts = topic.split(MQTT_TOPIC_PARTS_SEPARATOR);

        return patternTopicParts.reduce((wildcardValues, part, i) => {
            if (part === MQTT_TOPIC_PARTS_WILDCARD) {
                wildcardValues.push(topicParts[i]);
            }
            return wildcardValues;
        }, []);
    }
}
