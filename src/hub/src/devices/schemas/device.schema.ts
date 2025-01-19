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
    deviceAddress: {
        type: String,
        validate: [/^http(s)?:\/\/[A-Za-z\d.\/]+$/, 'Device address must be a valid URL'],
        required: false,
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
    },
});
