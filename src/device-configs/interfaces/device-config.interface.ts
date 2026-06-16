import { Document } from 'mongodb';
import { DeviceBrand, DeviceType } from 'devices/interfaces';
import { TransportProtocol } from 'devices-control/interfaces';

export enum DeviceConfigItemType {
    Number = 'number',
    Boolean = 'boolean',
    String = 'string',
    Enum = 'enum',
}

export interface DeviceConfigItemValue {
    label: string;
    name: string;
    path?: string;
}

export interface DeviceConfigItem {
    label: string;
    name: string;
    type: DeviceConfigItemType;
    description?: string;
    path?: string;
    values?: Array<DeviceConfigItemValue>;
}

export interface DeviceConfig extends Document {
    brand: DeviceBrand;
    type: DeviceType;
    transportProtocol: TransportProtocol;
    commands?: Array<DeviceConfigItem>;
    controls?: Array<DeviceConfigItem>;
    measurements?: Array<DeviceConfigItem>;
    createdAt: Date;
    updatedAt: Date;
}

export interface DeviceConfigKey {
    brand: DeviceBrand;
    type: DeviceType;
    transportProtocol: TransportProtocol;
}

export interface ParsedDeviceConfig extends DeviceConfigKey {
    commands?: Array<DeviceConfigItem>;
    controls?: Array<DeviceConfigItem>;
    measurements?: Array<DeviceConfigItem>;
}
