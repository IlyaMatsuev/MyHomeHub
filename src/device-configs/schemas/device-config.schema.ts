import { Schema } from 'mongoose';
import { DeviceBrand, DeviceType } from 'devices/interfaces';
import { TransportProtocol } from 'devices-control/interfaces';
import { DeviceConfigItemFormat, DeviceConfigItemType } from 'device-configs/interfaces';

const DeviceConfigItemValueSchema = new Schema(
    {
        label: { type: String, required: true },
        name: { type: String, required: true },
        path: { type: String, required: false },
    },
    { _id: false },
);

const DeviceConfigItemConstraintsSchema = new Schema(
    {
        min: { type: Number, required: false },
        max: { type: Number, required: false },
        integer: { type: Boolean, required: false },
        minLength: { type: Number, required: false },
        maxLength: { type: Number, required: false },
        pattern: { type: String, required: false },
        format: {
            type: String,
            required: false,
            enum: Object.values(DeviceConfigItemFormat) as Array<string>,
        },
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
        default: { type: Schema.Types.Mixed, required: false },
        required: { type: Boolean, required: false, default: false },
        constraints: { type: DeviceConfigItemConstraintsSchema, required: false, default: undefined },
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
        strict: { type: Boolean, required: false, default: true },
        commands: { type: [DeviceConfigItemSchema], required: false, default: [] },
        controls: { type: [DeviceConfigItemSchema], required: false, default: [] },
        measurements: { type: [DeviceConfigItemSchema], required: false, default: [] },
    },
    { timestamps: true },
);

DeviceConfigSchema.index({ brand: 1, type: 1, transportProtocol: 1 }, { unique: true });
