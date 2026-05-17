import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from 'db/db.module';
import { DevicesControlModule } from 'devices-control/devices-control.module';
import { MqttModule } from 'mqtt/mqtt.module';
import { DevicesController } from 'devices/devices.controller';
import { DevicesService } from 'devices/devices.service';
import { devicesProviders } from 'devices/devices.providers';

@Module({
    // TODO: Remove MQTT module from here
    imports: [DatabaseModule, DevicesControlModule, forwardRef(() => MqttModule)],
    controllers: [DevicesController],
    providers: [DevicesService, ...devicesProviders],
    exports: [DevicesService],
})
export class DevicesModule {}
