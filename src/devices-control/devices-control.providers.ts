import { DeviceControlServiceFactory, DeviceTransportService } from 'devices-control/interfaces';
import { DEVICES_CONTROL_FACTORY_PROVIDER, DEVICE_TRANSPORT_FACTORY_PROVIDER } from 'devices-control/devices-control.constants';
import { DevicesControlServiceFactory } from 'devices-control/devices-control-service.factory';
import {
    GoogleSpeakerControlServiceFactory,
    ShellyControlServiceFactory,
    TuyaControlServiceFactory,
    Esp32ControlServiceFactory,
    PhilipsControlServiceFactory,
} from 'devices-control/providers';
import {
    DeviceTransportServiceResolver,
    HttpTransportService,
    MqttTransportService,
    TuyaTransportService,
} from 'devices-control/transport';

export const providers = [
    {
        provide: DEVICES_CONTROL_FACTORY_PROVIDER,
        useFactory: (...controlServiceFactories: Array<DeviceControlServiceFactory>) =>
            new DevicesControlServiceFactory(controlServiceFactories),
        inject: [
            TuyaControlServiceFactory,
            GoogleSpeakerControlServiceFactory,
            ShellyControlServiceFactory,
            Esp32ControlServiceFactory,
            PhilipsControlServiceFactory,
        ],
    },
    {
        provide: DEVICE_TRANSPORT_FACTORY_PROVIDER,
        useFactory: (...transportServices: Array<DeviceTransportService>) => new DeviceTransportServiceResolver(transportServices),
        inject: [HttpTransportService, MqttTransportService, TuyaTransportService],
    },
];
