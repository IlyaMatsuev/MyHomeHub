import { Logger } from '@nestjs/common';
import { DeviceBrand, DeviceType } from 'devices/interfaces';
import { TransportProtocol } from 'devices-control/interfaces';
import { DeviceConfigItemType } from 'device-configs/interfaces';
import { DeviceConfigsParserService } from './device-configs-parser.service';

describe('DeviceConfigsParserService', () => {
    let parser: DeviceConfigsParserService;
    let warnSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        parser = new DeviceConfigsParserService();
        warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
        errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        warnSpy.mockRestore();
        errorSpy.mockRestore();
    });

    describe('parseFile', () => {
        it('should parse controls and measurements blocks for a brand', () => {
            const yaml = `
plug:
  http:
    controls:
      - label: "On"
        name: "on"
        type: boolean
        description: "Switch on/off state"
    measurements:
      - label: "Voltage"
        name: "voltage"
        type: number
        description: "voltage"
      - label: "Power"
        name: "power"
        type: number
        path: "apower"
`;

            const configs = parser.parseFile('/configs/shelly.yaml', yaml);

            expect(configs).toHaveLength(1);
            expect(configs[0]).toMatchObject({
                brand: DeviceBrand.Shelly,
                type: DeviceType.Plug,
                transportProtocol: TransportProtocol.Http,
                controls: [
                    {
                        label: 'On',
                        name: 'on',
                        type: DeviceConfigItemType.Boolean,
                        description: 'Switch on/off state',
                    },
                ],
                measurements: [
                    { label: 'Voltage', name: 'voltage', type: DeviceConfigItemType.Number, description: 'voltage' },
                    { label: 'Power', name: 'power', type: DeviceConfigItemType.Number, path: 'apower' },
                ],
            });
            expect(configs[0].commands).toBeUndefined();
        });

        it('should parse commands with nested value mappings', () => {
            const yaml = `
remote:
  zigbee:
    commands:
      - label: "On"
        name: "on"
        path: "action"
        type: boolean
        description: "Switch on/off state"
        values:
          - label: "On"
            name: "true"
            path: "on_press"
          - label: "Off"
            name: "false"
            path: "off_press"
`;

            const [config] = parser.parseFile('/configs/shelly.yaml', yaml);

            expect(config.type).toBe(DeviceType.Remote);
            expect(config.transportProtocol).toBe(TransportProtocol.Zigbee);
            expect(config.commands).toEqual([
                {
                    label: 'On',
                    name: 'on',
                    path: 'action',
                    type: DeviceConfigItemType.Boolean,
                    description: 'Switch on/off state',
                    values: [
                        { label: 'On', name: 'true', path: 'on_press' },
                        { label: 'Off', name: 'false', path: 'off_press' },
                    ],
                },
            ]);
        });

        it('should produce a config per (type, protocol) pair', () => {
            const yaml = `
plug:
  http:
    controls:
      - label: "On"
        name: "on"
        type: boolean
remote:
  zigbee:
    commands:
      - label: "On"
        name: "on"
        type: boolean
`;

            const configs = parser.parseFile('/configs/shelly.yaml', yaml);

            expect(configs).toHaveLength(2);
            expect(configs.map(c => c.type)).toEqual([DeviceType.Plug, DeviceType.Remote]);
            expect(configs.map(c => c.transportProtocol)).toEqual([TransportProtocol.Http, TransportProtocol.Zigbee]);
            expect(configs.every(c => c.brand === DeviceBrand.Shelly)).toBe(true);
        });

        it('should return an empty array when the filename does not match a known brand', () => {
            const yaml = `
plug:
  http:
    controls:
      - label: "On"
        name: "on"
        type: boolean
`;

            expect(parser.parseFile('/configs/unknown-brand.yaml', yaml)).toEqual([]);
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('does not match any known DeviceBrand'));
        });

        it('should skip unknown device types', () => {
            const yaml = `
not-a-real-type:
  http:
    controls:
      - label: "On"
        name: "on"
        type: boolean
plug:
  http:
    controls:
      - label: "On"
        name: "on"
        type: boolean
`;

            const configs = parser.parseFile('/configs/shelly.yaml', yaml);

            expect(configs).toHaveLength(1);
            expect(configs[0].type).toBe(DeviceType.Plug);
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping unknown device type "not-a-real-type"'));
        });

        it('should skip unknown transport protocols', () => {
            const yaml = `
plug:
  carrier-pigeon:
    controls:
      - label: "On"
        name: "on"
        type: boolean
`;

            const configs = parser.parseFile('/configs/shelly.yaml', yaml);

            expect(configs).toEqual([]);
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping unknown transport protocol "carrier-pigeon"'));
        });

        it('should skip items missing required label/name fields', () => {
            const yaml = `
plug:
  http:
    controls:
      - label: "On"
        type: boolean
      - label: "Brightness"
        name: "brightness"
        type: number
`;

            const [config] = parser.parseFile('/configs/shelly.yaml', yaml);

            expect(config.controls).toEqual([{ label: 'Brightness', name: 'brightness', type: DeviceConfigItemType.Number }]);
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping config item without required'));
        });

        it('should skip items with unknown type', () => {
            const yaml = `
plug:
  http:
    controls:
      - label: "On"
        name: "on"
        type: not-a-type
`;

            const [config] = parser.parseFile('/configs/shelly.yaml', yaml);

            expect(config.controls).toBeUndefined();
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping config item "on" with unknown type'));
        });

        it('should return an empty array and log an error on malformed YAML', () => {
            const malformed = 'plug:\n  http:\n  - this is: invalid\n    indentation';

            expect(parser.parseFile('/configs/shelly.yaml', malformed)).toEqual([]);
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to parse device config file'));
        });

        it('should accept all DeviceConfigItemType values', () => {
            const yaml = `
plug:
  http:
    controls:
      - label: "Numeric"
        name: "num"
        type: number
      - label: "Bool"
        name: "b"
        type: boolean
      - label: "Str"
        name: "s"
        type: string
      - label: "Enum"
        name: "e"
        type: enum
        values:
          - label: "A"
            name: "a"
          - label: "B"
            name: "b"
`;

            const [config] = parser.parseFile('/configs/shelly.yaml', yaml);

            expect(config.controls.map(c => c.type)).toEqual([
                DeviceConfigItemType.Number,
                DeviceConfigItemType.Boolean,
                DeviceConfigItemType.String,
                DeviceConfigItemType.Enum,
            ]);
            expect(config.controls[3].values).toEqual([
                { label: 'A', name: 'a' },
                { label: 'B', name: 'b' },
            ]);
        });

        it('should resolve the brand from the filename case-insensitively', () => {
            const yaml = `
speaker:
  http:
    commands:
      - label: "TTS"
        name: "text"
        type: string
`;

            const [config] = parser.parseFile('/path/to/GOOGLE.YAML', yaml);

            expect(config.brand).toBe(DeviceBrand.Google);
        });
    });
});
