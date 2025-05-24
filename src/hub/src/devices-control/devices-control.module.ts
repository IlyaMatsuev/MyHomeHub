import { Module } from '@nestjs/common';
import { CommonModule } from 'common/common.module';
import { providers } from 'devices-control/devices-control.providers';
import { TuyaControlServiceFactory } from 'devices-control/tuya';
import { GoogleSpeakerControlServiceFactory } from 'devices-control/google';
import { ShellyControlServiceFactory } from 'devices-control/shelly';
import { DEVICES_CONTROL_FACTORY_PROVIDER } from 'devices-control/devices-control.constants';

@Module({
    imports: [CommonModule],
    providers: [TuyaControlServiceFactory, GoogleSpeakerControlServiceFactory, ShellyControlServiceFactory, ...providers],
    exports: [DEVICES_CONTROL_FACTORY_PROVIDER],
})
export class DevicesControlModule {}
