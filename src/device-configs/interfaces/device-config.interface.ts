import { Document } from 'mongodb';
import { DeviceBrand, DevicePayload, DeviceType } from 'devices/interfaces';
import { TransportProtocol } from 'devices-control/interfaces';

export enum DeviceConfigItemType {
    Number = 'number',
    Boolean = 'boolean',
    String = 'string',
    Enum = 'enum',
    // Presence and the object shape are checked here,
    // The nested structure is delegated to the brand DTO
    Object = 'object',
}

export enum DeviceConfigItemFormat {
    HexColor = 'hex-color',
    Ip = 'ip',
    Url = 'url',
}

export enum DeviceConfigValidationPolicy {
    // Device config violation (e.g. invalid control name) rejects the device update
    Reject = 'reject',
    // Device config violation is ignored or sanitized when possible
    Sanitize = 'sanitize',
}

export interface DeviceConfigItemConstraints {
    min?: number;
    max?: number;
    integer?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    format?: DeviceConfigItemFormat;
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
    default?: unknown;
    required?: boolean;
    constraints?: DeviceConfigItemConstraints;
    values?: Array<DeviceConfigItemValue>;
}

export interface DeviceConfig extends Document {
    brand: DeviceBrand;
    type: DeviceType;
    transportProtocol: TransportProtocol;
    strict?: boolean;
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
    strict?: boolean;
    commands?: Array<DeviceConfigItem>;
    controls?: Array<DeviceConfigItem>;
    measurements?: Array<DeviceConfigItem>;
}

export const DEVICE_CONFIG_SECTIONS = ['commands', 'controls', 'measurements'] as const;

export type DeviceConfigSections = typeof DEVICE_CONFIG_SECTIONS;

export type DeviceConfigSection = DeviceConfigSections[number];

// Sections that are stored on a device document, unlike the commands that are only passed through to a device
export const DEVICE_CONFIG_PAYLOADS_SECTIONS = ['controls', 'measurements'] as const;

export type DevicePayloadSection = (typeof DEVICE_CONFIG_PAYLOADS_SECTIONS)[number];

export interface ParsedDeviceConfigPayload {
    commands: DevicePayload;
    controls: DevicePayload;
    measurements: DevicePayload;
}

export type DeviceConfigPayloads = Pick<ParsedDeviceConfigPayload, 'controls' | 'measurements'>;
