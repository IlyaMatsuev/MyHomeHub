import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Model } from 'mongoose';
import { DeviceBrand, DeviceType } from 'devices/interfaces';
import { TransportProtocol } from 'devices-control/interfaces';
import { DeviceConfig } from 'device-configs/interfaces';
import { DeviceConfigsParserService } from './device-configs-parser.service';
import { DeviceConfigsService } from './device-configs.service';
import { DeviceConfigsChangedEvent } from 'device-configs/events';

describe('DeviceConfigsService', () => {
    let tempDir: string;
    let model: jest.Mocked<Model<DeviceConfig>>;
    let configService: jest.Mocked<ConfigService>;
    let parser: DeviceConfigsParserService;
    let eventEmitter: jest.Mocked<EventEmitter2>;
    let service: DeviceConfigsService;
    let warnSpy: jest.SpyInstance;
    let logSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    const buildModelMock = () => ({
        updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ matchedCount: 1, upsertedCount: 0 }) }),
        deleteMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 0 }) }),
        findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) }),
        find: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }),
    });

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'device-configs-'));
        model = buildModelMock() as unknown as jest.Mocked<Model<DeviceConfig>>;
        configService = {
            get: jest.fn((key: string) => (key === 'DEVICE_CONFIGS_DIR' ? tempDir : undefined)),
        } as unknown as jest.Mocked<ConfigService>;
        parser = new DeviceConfigsParserService();
        eventEmitter = { emit: jest.fn() } as unknown as jest.Mocked<EventEmitter2>;
        service = new DeviceConfigsService(model, configService, parser, eventEmitter);
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

        it('should persist the strictness of every protocol block', async () => {
            writeFileSync(
                join(tempDir, 'shelly.yaml'),
                [
                    'plug:',
                    '  http:',
                    '    controls:',
                    '      - label: "On"',
                    '        name: "on"',
                    '        type: boolean',
                    'led:',
                    '  http:',
                    '    strict: false',
                    '    controls:',
                    '      - label: "On"',
                    '        name: "on"',
                    '        type: boolean',
                ].join('\n'),
            );

            await service.syncFromDisk();

            const calls = model.updateOne.mock.calls as unknown as Array<[{ type: DeviceType }, { $set: { strict: boolean } }]>;
            const strictByType = calls.map(([filter, update]) => [filter.type, update.$set.strict]);
            expect(strictByType).toEqual([
                [DeviceType.Plug, true],
                [DeviceType.LED, false],
            ]);
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

    describe('DeviceConfigsChangedEvent', () => {
        const writeShellyConfig = () => {
            writeFileSync(
                join(tempDir, 'shelly.yaml'),
                ['plug:', '  http:', '    controls:', '      - label: "On"', '        name: "on"', '        type: boolean'].join('\n'),
            );
        };

        it('should emit the parsed configs after the sync completes', async () => {
            writeShellyConfig();

            const parsed = await service.syncFromDisk();

            expect(eventEmitter.emit).toHaveBeenCalledWith(DeviceConfigsChangedEvent.eventName, new DeviceConfigsChangedEvent(parsed));
        });

        it('should emit on the initial sync, so the devices are reconciled on startup', async () => {
            writeShellyConfig();

            await service.onApplicationBootstrap();

            expect(eventEmitter.emit).toHaveBeenCalledWith(DeviceConfigsChangedEvent.eventName, expect.any(DeviceConfigsChangedEvent));
        });

        it('should emit an empty set of configs when every config file is gone', async () => {
            await service.syncFromDisk();

            expect(eventEmitter.emit).toHaveBeenCalledWith(DeviceConfigsChangedEvent.eventName, new DeviceConfigsChangedEvent([]));
        });

        it('should not emit when the configs directory does not exist', async () => {
            configService.get.mockReturnValue(join(tempDir, 'missing-subdir'));

            await service.syncFromDisk();

            expect(eventEmitter.emit).not.toHaveBeenCalled();
        });
    });

    describe('getConfig', () => {
        it('should query the config by brand, type and transport protocol only', async () => {
            const key = {
                brand: DeviceBrand.Shelly,
                type: DeviceType.Plug,
                transportProtocol: TransportProtocol.Http,
            };

            await service.getConfig({ ...key, extraField: 'ignored' } as never);

            expect(model.findOne).toHaveBeenCalledWith(key);
        });

        it('should query the database only once per config key', async () => {
            const key = { brand: DeviceBrand.Shelly, type: DeviceType.Plug, transportProtocol: TransportProtocol.Http };

            await service.getConfig(key);
            await service.getConfig(key);

            expect(model.findOne).toHaveBeenCalledTimes(1);
        });

        it('should cache the misses as well, so an unconfigured brand does not query on every payload', async () => {
            const key = { brand: DeviceBrand.Tuya, type: DeviceType.LED, transportProtocol: TransportProtocol.Tuya };

            await expect(service.getConfig(key)).resolves.toBeNull();
            await expect(service.getConfig(key)).resolves.toBeNull();

            expect(model.findOne).toHaveBeenCalledTimes(1);
        });

        it('should query each config key separately', async () => {
            await service.getConfig({ brand: DeviceBrand.Shelly, type: DeviceType.Plug, transportProtocol: TransportProtocol.Http });
            await service.getConfig({ brand: DeviceBrand.Shelly, type: DeviceType.LED, transportProtocol: TransportProtocol.Http });

            expect(model.findOne).toHaveBeenCalledTimes(2);
        });

        it('should drop the cached configs after a sync, so a yaml change applies right away', async () => {
            const key = { brand: DeviceBrand.Shelly, type: DeviceType.Plug, transportProtocol: TransportProtocol.Http };
            await service.getConfig(key);

            await service.syncFromDisk();
            await service.getConfig(key);

            expect(model.findOne).toHaveBeenCalledTimes(2);
        });
    });

    describe('getConfigs', () => {
        it('should return an empty array without querying when no keys are provided', async () => {
            const result = await service.getConfigs([]);

            expect(result).toEqual([]);
            expect(model.find).not.toHaveBeenCalled();
        });

        it('should query all provided keys with an $or filter', async () => {
            const keys = [
                { brand: DeviceBrand.Shelly, type: DeviceType.Plug, transportProtocol: TransportProtocol.Http },
                { brand: DeviceBrand.Philips, type: DeviceType.Remote, transportProtocol: TransportProtocol.Zigbee },
            ];

            await service.getConfigs(keys);

            expect(model.find).toHaveBeenCalledWith({ $or: keys });
        });
    });

    describe('onApplicationBootstrap', () => {
        it('should run an initial sync', async () => {
            writeFileSync(
                join(tempDir, 'google.yaml'),
                ['speaker:', '  http:', '    commands:', '      - label: "TTS"', '        name: "text"', '        type: string'].join('\n'),
            );

            await service.onApplicationBootstrap();

            expect(model.updateOne).toHaveBeenCalledTimes(1);
        });
    });
});
