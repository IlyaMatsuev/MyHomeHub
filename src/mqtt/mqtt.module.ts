import { forwardRef, Module } from '@nestjs/common';
import { DevicesModule } from 'devices/devices.module';
import { MqttService } from 'mqtt/mqtt.service';
import { MqttController } from 'mqtt/mqtt.controller';
import { mqttProviders } from 'mqtt/mqtt.providers';
import { ZigbeeStateMapperService } from 'mqtt/zigbee-state-mapper.service';

@Module({
    imports: [forwardRef(() => DevicesModule)],
    controllers: [MqttController],
    providers: [MqttService, ZigbeeStateMapperService, ...mqttProviders],
    exports: [MqttService],
})
export class MqttModule {}
