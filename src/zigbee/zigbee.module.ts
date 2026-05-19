import { forwardRef, Module } from '@nestjs/common';
import { ZigbeeService } from 'zigbee/zigbee.service';
import { MqttModule } from 'mqtt/mqtt.module';
import { DevicesModule } from 'devices/devices.module';

@Module({
    imports: [MqttModule, forwardRef(() => DevicesModule)],
    providers: [ZigbeeService],
    exports: [ZigbeeService],
})
export class ZigbeeModule {}
