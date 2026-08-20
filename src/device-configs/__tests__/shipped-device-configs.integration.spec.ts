import { readFileSync } from 'node:fs';
import { Logger } from '@nestjs/common';
import { resolve } from 'node:path';
import { DeviceBrand, DeviceType } from 'devices/interfaces';
import { TransportProtocol } from 'devices-control/interfaces';
import { DeviceConfig, DeviceConfigKey, ParsedDeviceConfig } from 'device-configs/interfaces';
import { DeviceConfigsMapperService } from 'device-configs/device-configs-mapper.service';
import { DeviceConfigsParserService } from 'device-configs/device-configs-parser.service';
import { DeviceConfigsService } from 'device-configs/device-configs.service';

describe('Shipped device configs', () => {
    const configsDir = resolve(__dirname, '../../../configs/devices');

    let debugSpy: jest.SpyInstance;

    beforeEach(() => {
        debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.clearAllMocks();
        debugSpy.mockRestore();
    });

    const parseConfigs = (fileName: string): Array<ParsedDeviceConfig> => {
        const filePath = resolve(configsDir, fileName);
        return new DeviceConfigsParserService().parseFile(filePath, readFileSync(filePath, 'utf8'));
    };

    const createMapper = (config: ParsedDeviceConfig): DeviceConfigsMapperService => {
        const mockDeviceConfigsService = { getConfig: jest.fn().mockResolvedValue(config as DeviceConfig) };
        return new DeviceConfigsMapperService(mockDeviceConfigsService as unknown as DeviceConfigsService);
    };

    describe('philips.yaml', () => {
        const configKey: DeviceConfigKey = {
            brand: DeviceBrand.Philips,
            type: DeviceType.Remote,
            transportProtocol: TransportProtocol.Zigbee,
        };

        let mapper: DeviceConfigsMapperService;

        beforeEach(() => {
            const config = parseConfigs('philips.yaml').find(
                parsedConfig => parsedConfig.type === configKey.type && parsedConfig.transportProtocol === configKey.transportProtocol,
            );
            mapper = createMapper(config);
        });

        it('should categorize a remote button press into the on command and the measurements', async () => {
            const result = await mapper.categorizeAndMapPayloadFromDevice(configKey, {
                action: 'off_press',
                battery: 100,
                linkquality: 164,
                update: { state: 'idle' },
            });

            expect(result).toEqual({
                commands: { on: false },
                controls: {},
                measurements: { battery: 100, linkquality: 164 },
            });
        });

        it.each([
            ['on_press', 'on', true],
            ['off_press', 'on', false],
            ['up_press', 'brightness', true],
            ['down_press', 'brightness', false],
        ])('should map the "%s" action to the "%s" command', async (action, command, value) => {
            const result = await mapper.categorizeAndMapPayloadFromDevice(configKey, { action });

            expect(result.commands).toEqual({ [command]: value });
        });

        it('should drop the release action that follows the button press', async () => {
            const result = await mapper.categorizeAndMapPayloadFromDevice(configKey, { action: 'off_press_release' });

            expect(result.commands).toEqual({});
            expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('action'));
        });
    });
});
