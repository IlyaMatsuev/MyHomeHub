import { Schema } from 'mongoose';
import { v4 as uuid } from 'uuid';
import { DeviceType, Room } from 'devices/interfaces';

export const DeviceSchema = new Schema({
    externalId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        default: () => uuid(),
    },
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minLength: 3,
        maxLength: 40,
    },
    // TODO: Add separate field for "brand". So that I have { "brand": "google", "type": "speaker" } or { "brand": "shelly", "type": "plug" }
    type: {
        type: String,
        required: true,
        enum: Object.values(DeviceType) as Array<string>,
    },
    room: {
        type: String,
        required: false,
        enum: Object.values(Room) as Array<string>,
    },
    ip: {
        type: String,
        validate: [/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, 'The value must be a valid IP address'],
        required: false,
    },
    tuyaDeviceId: {
        type: String,
        required: function () {
            return this.type === DeviceType.TuyaDevice;
        },
        validate: {
            validator: function (): boolean {
                return this.type === DeviceType.TuyaDevice;
            },
            message: `Tuya device id can be specified only for a device of type "${DeviceType.TuyaDevice}"`,
        },
    },
    tuyaDeviceLocalKey: {
        type: String,
        required: function () {
            return this.type === DeviceType.TuyaDevice;
        },
        validate: {
            validator: function (): boolean {
                return this.type === DeviceType.TuyaDevice;
            },
            message: `Tuya device local key can be specified only for a device of type "${DeviceType.TuyaDevice}"`,
        },
    },
    updateInterval: {
        type: Number,
        required: false,
        default: 0,
        min: 0,
    },
    controls: {
        type: Object,
        required: true,
        default: () => ({}),
    },
    measurements: {
        type: Object,
        required: false,
        default: () => ({}),
    },
});
