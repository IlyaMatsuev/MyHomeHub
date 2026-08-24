import { isHexColor, isIP, isURL } from 'class-validator';
import { DEVICE_ALLOWED_IP_VERSION } from 'devices/devices.constants';
import { DeviceConfigItem, DeviceConfigItemConstraints, DeviceConfigItemFormat, DeviceConfigItemType } from 'device-configs/interfaces';

type FormatValidator = (value: string) => boolean;

const FORMAT_VALIDATORS: Record<DeviceConfigItemFormat, FormatValidator> = {
    [DeviceConfigItemFormat.HexColor]: value => isHexColor(value),
    [DeviceConfigItemFormat.Ip]: value => isIP(value, DEVICE_ALLOWED_IP_VERSION),
    [DeviceConfigItemFormat.Url]: value => isURL(value),
};

const NUMBER_CONSTRAINTS: ReadonlyArray<keyof DeviceConfigItemConstraints> = ['min', 'max', 'integer'];
const STRING_CONSTRAINTS: ReadonlyArray<keyof DeviceConfigItemConstraints> = ['minLength', 'maxLength', 'pattern', 'format'];

export const APPLICABLE_CONSTRAINTS: Record<DeviceConfigItemType, ReadonlyArray<keyof DeviceConfigItemConstraints>> = {
    [DeviceConfigItemType.Number]: NUMBER_CONSTRAINTS,
    [DeviceConfigItemType.String]: STRING_CONSTRAINTS,
    [DeviceConfigItemType.Boolean]: [],
    [DeviceConfigItemType.Enum]: [],
    [DeviceConfigItemType.Object]: [],
};

export function isEmptyValue(value: unknown): boolean {
    return value === null || value === undefined;
}

export function isNotEmptyValue(value: unknown): boolean {
    return !isEmptyValue(value);
}

export function getItemDefaultValue(item: DeviceConfigItem): unknown {
    return item.default ?? null;
}

/**
 * Checks a single value against the rules declared for a command/control/measurement in a device config.
 * Returns a human-readable message when the value violates the rules, "null" otherwise.
 * Empty values are considered valid here - their presence is enforced by the caller via "required"
 */
export function validateItemValue(item: DeviceConfigItem, value: unknown): string | null {
    if (isEmptyValue(value)) {
        return null;
    }
    switch (item.type) {
        case DeviceConfigItemType.Boolean:
            return validateBooleanValue(item, value);
        case DeviceConfigItemType.Number:
            return validateNumberValue(item, value);
        case DeviceConfigItemType.String:
            return validateStringValue(item, value);
        case DeviceConfigItemType.Enum:
            return validateEnumValue(item, value);
        case DeviceConfigItemType.Object:
            return isPlainObject(value) ? null : `"${item.name}" must be an object`;
        default:
            return null;
    }
}

function isPlainObject(value: unknown): boolean {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateBooleanValue(item: DeviceConfigItem, value: unknown): string | null {
    return typeof value === 'boolean' ? null : `"${item.name}" must be a boolean value`;
}

function validateNumberValue(item: DeviceConfigItem, value: unknown): string | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return `"${item.name}" must be a number`;
    }
    const constraints = item.constraints ?? {};
    if (constraints.integer && !Number.isInteger(value)) {
        return `"${item.name}" must be an integer number`;
    }
    if (isNotEmptyValue(constraints.min) && value < constraints.min) {
        return `"${item.name}" must not be less than ${constraints.min}`;
    }
    if (isNotEmptyValue(constraints.max) && value > constraints.max) {
        return `"${item.name}" must not be greater than ${constraints.max}`;
    }
    return null;
}

function validateStringValue(item: DeviceConfigItem, value: unknown): string | null {
    if (typeof value !== 'string') {
        return `"${item.name}" must be a string`;
    }
    const constraints = item.constraints ?? {};
    if (isNotEmptyValue(constraints.minLength) && value.length < constraints.minLength) {
        return `"${item.name}" must be longer than or equal to ${constraints.minLength} characters`;
    }
    if (isNotEmptyValue(constraints.maxLength) && value.length > constraints.maxLength) {
        return `"${item.name}" must be shorter than or equal to ${constraints.maxLength} characters`;
    }
    if (isNotEmptyValue(constraints.pattern) && !new RegExp(constraints.pattern).test(value)) {
        return `"${item.name}" must match the ${constraints.pattern} pattern`;
    }
    if (isNotEmptyValue(constraints.format) && !FORMAT_VALIDATORS[constraints.format](value)) {
        return `"${item.name}" must be a valid ${constraints.format} value`;
    }
    return null;
}

function validateEnumValue(item: DeviceConfigItem, value: unknown): string | null {
    const allowedValues = (item.values ?? []).map(itemValue => itemValue.name);
    if (!allowedValues.length) {
        return typeof value === 'string' ? null : `"${item.name}" must be a string`;
    }
    return allowedValues.includes(String(value)) ? null : `"${item.name}" must be one of the following values: ${allowedValues.join(', ')}`;
}
