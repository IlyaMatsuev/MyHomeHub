import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { DEVICE_PAIR_ACCEPT_TOPIC_NAME, MQTT_CLIENT_PROVIDER_NAME } from 'mqtt/mqtt.constants';
import { Device } from 'devices/interfaces';
import { PairAcceptDto } from 'mqtt/dto';

@Injectable()
export class MqttService {
    constructor(@Inject(MQTT_CLIENT_PROVIDER_NAME) private readonly client: ClientProxy) {}

    pairDevice(device: Device) {
        this.client.emit(DEVICE_PAIR_ACCEPT_TOPIC_NAME, PairAcceptDto.accept(device.externalId, device.updateInterval));
    }

    rejectDevice(reason: string) {
        this.client.emit(DEVICE_PAIR_ACCEPT_TOPIC_NAME, PairAcceptDto.reject(`Device pairing has been rejected: ${reason}`));
    }
}
