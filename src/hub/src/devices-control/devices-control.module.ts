import { Module } from '@nestjs/common';
import { CommonModule } from 'common/common.module';
import { MqttModule } from 'mqtt/mqtt.module';
import {
    GoogleSpeakerControlServiceFactory,
    ShellyControlServiceFactory,
    TuyaControlServiceFactory,
    Esp32ControlServiceFactory,
} from 'devices-control/providers';
import { providers } from 'devices-control/devices-control.providers';
import { DEVICES_CONTROL_FACTORY_PROVIDER } from 'devices-control/devices-control.constants';

@Module({
    imports: [CommonModule, MqttModule],
    providers: [
        TuyaControlServiceFactory,
        GoogleSpeakerControlServiceFactory,
        ShellyControlServiceFactory,
        Esp32ControlServiceFactory,
        ...providers,
    ],
    exports: [DEVICES_CONTROL_FACTORY_PROVIDER],
})
export class DevicesControlModule {}
