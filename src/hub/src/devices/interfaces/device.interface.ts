import { Document } from 'mongoose';
import { DeviceType, Room } from './common';

// TODO: Make sure Document fields are not exposed in API (_id and __v)
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
