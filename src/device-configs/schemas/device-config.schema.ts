import { Schema } from 'mongoose';
import { DeviceBrand, DeviceType } from 'devices/interfaces';
import { TransportProtocol } from 'devices-control/interfaces';
import { DeviceConfigItemType } from 'device-configs/interfaces';

const DeviceConfigItemValueSchema = new Schema(
    {
        label: { type: String, required: true },
        name: { type: String, required: true },
        path: { type: String, required: false },
    },
    { _id: false },
);

const DeviceConfigItemSchema = new Schema(
    {
        label: { type: String, required: true },
        name: { type: String, required: true },
        type: {
            type: String,
            required: true,
            enum: Object.values(DeviceConfigItemType) as Array<string>,
        },
        description: { type: String, required: false },
        path: { type: String, required: false },
        values: { type: [DeviceConfigItemValueSchema], required: false, default: undefined },
    },
    { _id: false },
);

export const DeviceConfigSchema = new Schema(
    {
        brand: {
            type: String,
            required: true,
            enum: Object.values(DeviceBrand) as Array<string>,
        },
        type: {
            type: String,
            required: true,
            enum: Object.values(DeviceType) as Array<string>,
        },
        transportProtocol: {
            type: String,
            required: true,
            enum: Object.values(TransportProtocol) as Array<string>,
        },
        commands: { type: [DeviceConfigItemSchema], required: false, default: [] },
        controls: { type: [DeviceConfigItemSchema], required: false, default: [] },
        measurements: { type: [DeviceConfigItemSchema], required: false, default: [] },
    },
    { timestamps: true },
);

DeviceConfigSchema.index({ brand: 1, type: 1, transportProtocol: 1 }, { unique: true });
