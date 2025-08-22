import { DeviceControlServiceFactory } from 'devices-control/interfaces';
import { DEVICES_CONTROL_FACTORY_PROVIDER } from 'devices-control/devices-control.constants';
import { DevicesControlServiceFactory } from 'devices-control/devices-control-service.factory';
import {
    GoogleSpeakerControlServiceFactory,
    ShellyControlServiceFactory,
    TuyaControlServiceFactory,
    Esp32ControlServiceFactory,
} from 'devices-control/providers';

export const providers = [
    {
        provide: DEVICES_CONTROL_FACTORY_PROVIDER,
        useFactory: (...controlServiceFactories: Array<DeviceControlServiceFactory>) =>
            new DevicesControlServiceFactory(controlServiceFactories),
        inject: [TuyaControlServiceFactory, GoogleSpeakerControlServiceFactory, ShellyControlServiceFactory, Esp32ControlServiceFactory],
    },
];
