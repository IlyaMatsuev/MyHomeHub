import { Document } from 'mongoose';
import { DeviceBrand, DeviceType, Room } from 'devices/interfaces';

export interface Device extends Document<string> {
    externalId: string;
    name: string;
    type: DeviceType;
    room: Room;
    brand: DeviceBrand;
    ip: string;
    tuyaDeviceId: string;
    tuyaDeviceLocalKey: string;
    updateInterval: number;
    controls: Record<string, unknown>;
    measurements: Record<string, unknown>;
}

export type DeviceFilter = Partial<Omit<Device, keyof Document> & { _id: string }>;

export interface GetDeviceOptions {
    strict: boolean;
}
