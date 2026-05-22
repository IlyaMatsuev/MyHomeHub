import { Module } from '@nestjs/common';
import { CommonModule } from 'common/common.module';
import { MqttModule } from 'mqtt/mqtt.module';
import {
    GoogleSpeakerControlServiceFactory,
    ShellyControlServiceFactory,
    TuyaControlServiceFactory,
    Esp32ControlServiceFactory,
    PhilipsControlServiceFactory,
} from 'devices-control/providers';
import { providers } from 'devices-control/devices-control.providers';
import { DEVICES_CONTROL_FACTORY_PROVIDER } from 'devices-control/devices-control.constants';
import { HttpTransportService, MqttTransportService, TuyaTransportService, ZigbeeTransportService } from 'devices-control/transport';

@Module({
    imports: [CommonModule, MqttModule],
    providers: [
        TuyaControlServiceFactory,
        GoogleSpeakerControlServiceFactory,
        ShellyControlServiceFactory,
        Esp32ControlServiceFactory,
        PhilipsControlServiceFactory,

        HttpTransportService,
        MqttTransportService,
        TuyaTransportService,
        ZigbeeTransportService,

        ...providers,
    ],
    exports: [DEVICES_CONTROL_FACTORY_PROVIDER],
})
export class DevicesControlModule {}
