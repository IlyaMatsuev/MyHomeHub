import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { DeviceBrand, DeviceType } from 'devices/interfaces';
import { TransportProtocol } from 'devices-control/interfaces';
import { DeviceConfig } from 'device-configs/interfaces';
import { DeviceConfigsParserService } from './device-configs-parser.service';
import { DeviceConfigsService } from './device-configs.service';

describe('DeviceConfigsService', () => {
    let tempDir: string;
    let model: jest.Mocked<Model<DeviceConfig>>;
    let configService: jest.Mocked<ConfigService>;
    let parser: DeviceConfigsParserService;
    let service: DeviceConfigsService;
    let warnSpy: jest.SpyInstance;
    let logSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    const buildModelMock = () => ({
        updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ matchedCount: 1, upsertedCount: 0 }) }),
        deleteMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 0 }) }),
    });

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'device-configs-'));
        model = buildModelMock() as unknown as jest.Mocked<Model<DeviceConfig>>;
        configService = {
            get: jest.fn((key: string) => (key === 'DEVICE_CONFIGS_DIR' ? tempDir : undefined)),
        } as unknown as jest.Mocked<ConfigService>;
        parser = new DeviceConfigsParserService();
        service = new DeviceConfigsService(model, configService, parser);
        warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
        logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
        errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
        warnSpy.mockRestore();
        logSpy.mockRestore();
        errorSpy.mockRestore();
        service.onModuleDestroy();
    });

    describe('getConfigsDir', () => {
        it('should fall back to the default directory under cwd when env var is missing', () => {
            configService.get.mockReturnValue(undefined);

            expect(service.getConfigsDir()).toBe(join(process.cwd(), 'configs/devices'));
        });

        it('should return the configured directory as an absolute path', () => {
            configService.get.mockReturnValue('/absolute/path');

            expect(service.getConfigsDir()).toBe('/absolute/path');
        });

        it('should resolve relative configured directories against cwd', () => {
            configService.get.mockReturnValue('some/relative/path');

            expect(service.getConfigsDir()).toBe(join(process.cwd(), 'some/relative/path'));
        });
    });

    describe('syncFromDisk', () => {
        it('should warn and return empty when the configs directory does not exist', async () => {
            configService.get.mockReturnValue(join(tempDir, 'missing-subdir'));

            const result = await service.syncFromDisk();

            expect(result).toEqual([]);
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('does not exist'));
            expect(model.updateOne).not.toHaveBeenCalled();
        });

        it('should upsert one document per parsed (brand, type, transportProtocol)', async () => {
            writeFileSync(
                join(tempDir, 'shelly.yaml'),
                [
                    'plug:',
                    '  http:',
                    '    controls:',
                    '      - label: "On"',
                    '        name: "on"',
                    '        type: boolean',
                    'remote:',
                    '  zigbee:',
                    '    commands:',
                    '      - label: "On"',
                    '        name: "on"',
                    '        type: boolean',
                ].join('\n'),
            );

            const parsed = await service.syncFromDisk();

            expect(parsed).toHaveLength(2);
            expect(model.updateOne).toHaveBeenCalledTimes(2);

            const [firstFilter, firstUpdate, firstOptions] = model.updateOne.mock.calls[0] as unknown as [
                Record<string, unknown>,
                Record<string, unknown>,
                Record<string, unknown>,
            ];
            expect(firstFilter).toEqual({
                brand: DeviceBrand.Shelly,
                type: DeviceType.Plug,
                transportProtocol: TransportProtocol.Http,
            });
            expect(firstUpdate).toMatchObject({
                $set: {
                    controls: [expect.objectContaining({ name: 'on' })],
                },
                $setOnInsert: expect.objectContaining({ brand: DeviceBrand.Shelly }),
            });
            expect(firstOptions).toEqual({ upsert: true, runValidators: true });

            const [secondFilter] = model.updateOne.mock.calls[1] as unknown as [Record<string, unknown>];
            expect(secondFilter).toEqual({
                brand: DeviceBrand.Shelly,
                type: DeviceType.Remote,
                transportProtocol: TransportProtocol.Zigbee,
            });
        });

        it('should delete all documents when no configs are parsed', async () => {
            await service.syncFromDisk();

            expect(model.deleteMany).toHaveBeenCalledWith({});
        });

        it('should delete only documents not in the parsed set when configs are present', async () => {
            writeFileSync(
                join(tempDir, 'google.yaml'),
                ['speaker:', '  http:', '    commands:', '      - label: "TTS"', '        name: "text"', '        type: string'].join('\n'),
            );

            await service.syncFromDisk();

            expect(model.deleteMany).toHaveBeenCalledWith({
                $nor: [
                    {
                        brand: DeviceBrand.Google,
                        type: DeviceType.Speaker,
                        transportProtocol: TransportProtocol.Http,
                    },
                ],
            });
        });

        it('should ignore files without a yaml/yml extension', async () => {
            writeFileSync(join(tempDir, 'shelly.txt'), 'plug: { http: { controls: [] } }');

            const result = await service.syncFromDisk();

            expect(result).toEqual([]);
            expect(model.updateOne).not.toHaveBeenCalled();
        });

        it('should also pick up .yml files', async () => {
            writeFileSync(
                join(tempDir, 'google.yml'),
                ['speaker:', '  http:', '    commands:', '      - label: "TTS"', '        name: "text"', '        type: string'].join('\n'),
            );

            const result = await service.syncFromDisk();

            expect(result).toHaveLength(1);
            expect(model.updateOne).toHaveBeenCalledTimes(1);
        });

        it('should load only the specified file when a filename is given', async () => {
            writeFileSync(
                join(tempDir, 'shelly.yaml'),
                ['plug:', '  http:', '    controls:', '      - label: "On"', '        name: "on"', '        type: boolean'].join('\n'),
            );
            writeFileSync(
                join(tempDir, 'google.yaml'),
                ['speaker:', '  http:', '    commands:', '      - label: "TTS"', '        name: "text"', '        type: string'].join('\n'),
            );

            const result = await service.syncFromDisk('google.yaml');

            expect(result).toHaveLength(1);
            expect(model.updateOne).toHaveBeenCalledTimes(1);
            const [filter] = model.updateOne.mock.calls[0] as unknown as [Record<string, unknown>];
            expect(filter).toEqual({
                brand: DeviceBrand.Google,
                type: DeviceType.Speaker,
                transportProtocol: TransportProtocol.Http,
            });
        });

        it('should treat every doc outside the specified file as stale when a filename is given', async () => {
            writeFileSync(
                join(tempDir, 'shelly.yaml'),
                ['plug:', '  http:', '    controls:', '      - label: "On"', '        name: "on"', '        type: boolean'].join('\n'),
            );
            writeFileSync(
                join(tempDir, 'google.yaml'),
                ['speaker:', '  http:', '    commands:', '      - label: "TTS"', '        name: "text"', '        type: string'].join('\n'),
            );

            await service.syncFromDisk('google.yaml');

            expect(model.deleteMany).toHaveBeenCalledWith({
                $nor: [
                    {
                        brand: DeviceBrand.Google,
                        type: DeviceType.Speaker,
                        transportProtocol: TransportProtocol.Http,
                    },
                ],
            });
        });

        it('should log and wipe the collection when the specified filename cannot be read', async () => {
            const result = await service.syncFromDisk('missing.yaml');

            expect(result).toEqual([]);
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to read device config file'));
            expect(model.updateOne).not.toHaveBeenCalled();
            expect(model.deleteMany).toHaveBeenCalledWith({});
        });
    });

    describe('onModuleInit', () => {
        it('should run an initial sync', async () => {
            writeFileSync(
                join(tempDir, 'google.yaml'),
                ['speaker:', '  http:', '    commands:', '      - label: "TTS"', '        name: "text"', '        type: string'].join('\n'),
            );

            await service.onModuleInit();

            expect(model.updateOne).toHaveBeenCalledTimes(1);
        });
    });
});
