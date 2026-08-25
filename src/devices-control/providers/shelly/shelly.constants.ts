export const SHELLY_RPC_COMPONENT_ID = 0;

// Percentage
export const SHELLY_LED_MIN_BRIGHTNESS = 0;
export const SHELLY_LED_MAX_BRIGHTNESS = 100;

// Kelvins temp range
export const SHELLY_LED_MIN_TEMPERATURE = 2700;
export const SHELLY_LED_MAX_TEMPERATURE = 6500;

// Seconds of the fade between the light states
export const SHELLY_LED_MIN_TRANSITION_DURATION = 0.5;
export const SHELLY_LED_MAX_TRANSITION_DURATION = 10800;

// Available components for the Shelly device can be checked via:
// https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Shelly/#shellygetcomponents-example
export enum ShellyComponent {
    Switch = 'Switch',
    RGBCCT = 'RGBCCT',
}

// Selects which of the independently stored "rgb"/"ct" values of a RGBCCT component actually drives the LEDs
export enum ShellyLedMode {
    Rgb = 'rgb',
    Cct = 'cct',
}

export interface ShellyControlParam {
    namePath: string;
    transform?: (value: unknown) => unknown;
}

// Shelly `params` mappings from the names of the hub controls
export const SHELLY_CONTROL_PARAMS: Record<string, ShellyControlParam> = {
    on: { namePath: 'on' },
    mode: { namePath: 'mode' },
    brightness: { namePath: 'brightness' },
    temperature: { namePath: 'ct' },
    transitionDuration: { namePath: 'transition_duration' },
    color: { namePath: 'rgb', transform: value => toRgbArray(value) },
};

// Shelly status fields the hub controls are read from. Kept apart from SHELLY_CONTROL_PARAMS because the "Set" params
// and the "GetStatus" fields of the same control differ (e.g. "on" is set as "on" but reported back as "output").
// The controls the status does not report (like "transitionDuration") are simply not listed here
export const SHELLY_STATUS_CONTROLS: Record<string, ShellyControlParam> = {
    on: { namePath: 'output' },
    mode: { namePath: 'mode' },
    brightness: { namePath: 'brightness' },
    temperature: { namePath: 'ct' },
    color: { namePath: 'rgb', transform: value => toHexColor(value) },
};

// Available controls for each Shelly component
export const SHELLY_COMPONENT_CONTROLS: Record<ShellyComponent, ReadonlyArray<string>> = {
    [ShellyComponent.Switch]: ['on'],
    [ShellyComponent.RGBCCT]: ['on', 'mode', 'brightness', 'color', 'temperature', 'transitionDuration'],
};

// [255, 0, 128] -> "#ff0080"
function toHexColor(value: unknown): unknown {
    if (!Array.isArray(value) || value.length < 3) {
        return value;
    }
    const channels = value.slice(0, 3).map(channel => Number(channel));
    if (channels.some(channel => !Number.isFinite(channel))) {
        return value;
    }
    return `#${channels.map(channel => clampColorChannel(channel).toString(16).padStart(2, '0')).join('')}`;
}

function clampColorChannel(channel: number): number {
    return Math.min(Math.max(Math.round(channel), 0), 255);
}

function toRgbArray(value: unknown): unknown {
    const hex = `${value}`.replace('#', '');
    const normalized = hex.length === 3 || hex.length === 4 ? [...hex.slice(0, 3)].map(char => `${char}${char}`) : hex.match(/.{2}/g);
    if (!normalized || normalized.length < 3) {
        return value;
    }
    return normalized.slice(0, 3).map(channel => parseInt(channel, 16));
}
