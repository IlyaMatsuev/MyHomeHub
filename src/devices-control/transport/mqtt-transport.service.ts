import { Injectable } from '@nestjs/common';
import { MqttService } from 'mqtt/mqtt.service';
import { DeviceTransportService, MqttMessage, TransportProtocol } from 'devices-control/interfaces';

@Injectable()
export class MqttTransportService implements DeviceTransportService {
    readonly protocol = TransportProtocol.Mqtt;

    constructor(private readonly mqttService: MqttService) {}

    async send(message: MqttMessage): Promise<void> {
        this.mqttService.publish(message.topic, message.payload, ...(message.topicParams ?? []));
    }
}
