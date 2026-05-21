import { Document } from 'mongodb';
import { DeviceBrand, DevicePayload, DeviceType, Room } from 'devices/interfaces';
import { TransportProtocol } from 'devices-control/interfaces';

export interface Device extends Document {
    externalId: string;
    name: string;
    type: DeviceType;
    room: Room;
    brand: DeviceBrand;
    transportProtocol: TransportProtocol;
    ip: string;
    tuyaDeviceId: string;
    tuyaDeviceLocalKey: string;
    zigbeeFriendlyName: string;
    zigbeeIeeeAddress: string;
    updateInterval: number;
    controls: DevicePayload;
    controlsUpdatedAt: Date;
    measurements: DevicePayload;
    measurementsUpdatedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export type DeviceFilter = Partial<Device & { _id: string }>;

export interface GetDeviceOptions {
    strict: boolean;
}
