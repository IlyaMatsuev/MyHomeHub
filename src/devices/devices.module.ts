import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from 'db/db.module';
import { DevicesControlModule } from 'devices-control/devices-control.module';
import { DevicesController } from 'devices/devices.controller';
import { DevicesService } from 'devices/devices.service';
import { devicesProviders } from 'devices/devices.providers';
import { DevicesMqttController } from 'devices/devices-mqtt.controller';
import { DevicesMqttService } from 'devices/devices-mqtt.service';
import { ZigbeeModule } from 'zigbee/zigbee.module';
import { MqttModule } from 'mqtt/mqtt.module';
import { DeviceConfigsModule } from 'device-configs/device-configs.module';

@Module({
    imports: [DatabaseModule, DevicesControlModule, MqttModule, DeviceConfigsModule, forwardRef(() => ZigbeeModule)],
    controllers: [DevicesController, DevicesMqttController],
    providers: [DevicesService, DevicesMqttService, ...devicesProviders],
    exports: [DevicesService],
})
export class DevicesModule {}
