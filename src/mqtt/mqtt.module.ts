import { Module } from '@nestjs/common';
import { MqttService } from 'mqtt/mqtt.service';
import { mqttProviders } from 'mqtt/mqtt.providers';

@Module({
    imports: [],
    controllers: [],
    providers: [MqttService, ...mqttProviders],
    exports: [MqttService],
})
export class MqttModule {}
