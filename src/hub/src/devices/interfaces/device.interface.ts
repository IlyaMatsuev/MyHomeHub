import { Document } from 'mongoose';
import { DeviceType, Room } from './common';

export interface Device extends Document<string> {
    externalId: string;
    name: string;
    type: DeviceType;
    room: Room;
    updateInterval: number;
    controls: Record<string, unknown>;
    measurements: Record<string, unknown>;
}

export type DeviceFilter = Partial<Omit<Device, keyof Document> & { _id: string }>;

export interface GetDeviceOptions {
    strict: boolean;
}
