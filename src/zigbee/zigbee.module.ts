import { forwardRef, Module } from '@nestjs/common';
import { ZigbeeService } from 'zigbee/zigbee.service';
import { MqttModule } from 'mqtt/mqtt.module';
import { DevicesModule } from 'devices/devices.module';
import { ZigbeeController } from 'zigbee/zigbee.controller';
import { DeviceConfigsModule } from 'device-configs/device-configs.module';

@Module({
    imports: [MqttModule, DeviceConfigsModule, forwardRef(() => DevicesModule)],
    controllers: [ZigbeeController],
    providers: [ZigbeeService],
    exports: [ZigbeeService],
})
export class ZigbeeModule {}
