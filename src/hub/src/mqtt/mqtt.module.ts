import { Module } from '@nestjs/common';
import { DevicesModule } from 'devices/devices.module';
import { MqttService } from 'mqtt/mqtt.service';
import { MqttController } from 'mqtt/mqtt.controller';
import { mqttProviders } from 'mqtt/mqtt.providers';

@Module({
    imports: [DevicesModule],
    controllers: [MqttController],
    providers: [MqttService, ...mqttProviders],
})
export class MqttModule {}
