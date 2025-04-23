import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { MQTT_CLIENT_PROVIDER_NAME } from 'mqtt/mqtt.constants';

@Injectable()
export class MqttService {
    constructor(@Inject(MQTT_CLIENT_PROVIDER_NAME) private readonly client: ClientProxy) {}
}
