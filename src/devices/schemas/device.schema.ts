import { Schema } from 'mongoose';
import { v4 as uuid } from 'uuid';
import { ZIGBEE_FRIENDLY_NAME_MAX_LENGTH, ZIGBEE_FRIENDLY_NAME_MIN_LENGTH, ZIGBEE_IEEE_ADDRESS_REGEX } from 'common/common.constants';
import { DeviceBrand, DeviceType, Room } from 'devices/interfaces';
import { DEVICE_DEFAULT_UPDATE_INTERVAL, DEVICE_NAME_MAX_LENGTH, DEVICE_NAME_MIN_LENGTH } from 'devices/devices.constants';
import { TransportProtocol } from 'devices-control/interfaces';

export const DeviceSchema = new Schema(
    {
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
        transportProtocol: {
            type: String,
            required: true,
            enum: Object.values(TransportProtocol) as Array<string>,
        },
        zigbeeFriendlyName: {
            type: String,
            index: true,
            unique: true,
            sparse: true,
            minLength: ZIGBEE_FRIENDLY_NAME_MIN_LENGTH,
            maxLength: ZIGBEE_FRIENDLY_NAME_MAX_LENGTH,
            required: function () {
                return !!this.zigbeeIeeeAddress;
            },
            validate: [
                {
                    validator: function (): boolean {
                        return !!this.zigbeeIeeeAddress;
                    },
                    message: `Zigbee friendly name can be specified only together with Zigbee IEEE address`,
                },
            ],
        },
        zigbeeIeeeAddress: {
            type: String,
            index: true,
            required: function () {
                return this.transportProtocol === TransportProtocol.Zigbee;
            },
            validate: [
                {
                    validator: function (): boolean {
                        return this.transportProtocol === TransportProtocol.Zigbee;
                    },
                    message: 'Zigbee IEEE address cannot be assign to a non-Zigbee device',
                },
                {
                    validator: (value: string): boolean => ZIGBEE_IEEE_ADDRESS_REGEX.test(value),
                    message: 'Zigbee IEEE address must match the format 0x followed by 16 hex characters',
                },
            ],
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
        controlsUpdatedAt: {
            type: Date,
        },
        measurements: {
            type: Object,
            required: false,
            default: () => ({}),
        },
        measurementsUpdatedAt: {
            type: Date,
        },
    },
    { timestamps: true },
);

DeviceSchema.pre('save', function (next) {
    if (this.isModified('controls')) {
        this.controlsUpdatedAt = new Date();
    }
    if (this.isModified('measurements')) {
        this.measurementsUpdatedAt = new Date();
    }
    next();
});
