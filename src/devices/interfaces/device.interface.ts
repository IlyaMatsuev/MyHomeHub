import { Document } from 'mongodb';
import { DeviceBrand, DevicePayload, DeviceType, Room } from 'devices/interfaces';

export interface Device extends Document {
    externalId: string;
    name: string;
    type: DeviceType;
    room: Room;
    brand: DeviceBrand;
    ip: string;
    tuyaDeviceId: string;
    tuyaDeviceLocalKey: string;
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
