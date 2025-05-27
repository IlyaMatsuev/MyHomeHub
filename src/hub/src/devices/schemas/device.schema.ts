import { Schema } from 'mongoose';
import { v4 as uuid } from 'uuid';
import { DeviceBrand, DeviceType, Room } from 'devices/interfaces';
import { DEVICE_DEFAULT_UPDATE_INTERVAL, DEVICE_NAME_MAX_LENGTH, DEVICE_NAME_MIN_LENGTH } from 'devices/devices.constants';

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
        minLength: DEVICE_NAME_MIN_LENGTH,
        maxLength: DEVICE_NAME_MAX_LENGTH,
    },
    type: {
        type: String,
        required: true,
        enum: Object.values(DeviceType) as Array<string>,
    },
    brand: {
        type: String,
        required: false,
        enum: Object.values(DeviceBrand) as Array<string>,
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
            return this.brand === DeviceBrand.Tuya;
        },
        validate: {
            validator: function (): boolean {
                return this.brand === DeviceBrand.Tuya;
            },
            message: `Tuya device id can be specified only for a device of brand "${DeviceBrand.Tuya}"`,
        },
    },
    tuyaDeviceLocalKey: {
        type: String,
        required: function () {
            return this.brand === DeviceBrand.Tuya;
        },
        validate: {
            validator: function (): boolean {
                return this.brand === DeviceBrand.Tuya;
            },
            message: `Tuya device local key can be specified only for a device of brand "${DeviceBrand.Tuya}"`,
        },
    },
    updateInterval: {
        type: Number,
        required: false,
        default: DEVICE_DEFAULT_UPDATE_INTERVAL,
        min: DEVICE_DEFAULT_UPDATE_INTERVAL,
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
