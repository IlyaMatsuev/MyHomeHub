import { existsSync, FSWatcher, watch } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path, { extname, isAbsolute, join, resolve } from 'node:path';
import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Model } from 'mongoose';
import {
    DEFAULT_DEVICE_CONFIGS_DIR,
    DEVICE_CONFIGS_FILE_EXTENSIONS,
    DEVICE_CONFIGS_WATCHER_DEBOUNCE_MS,
    DEVICE_CONFIG_MODEL_PROVIDER_NAME,
} from 'device-configs/device-configs.constants';
import { DeviceConfig, DeviceConfigKey, ParsedDeviceConfig } from 'device-configs/interfaces';
import { DeviceConfigsParserService } from 'device-configs/device-configs-parser.service';
import { DeviceConfigsChangedEvent } from 'device-configs/events';

@Injectable()
export class DeviceConfigsService implements OnApplicationBootstrap, OnModuleDestroy {
    private readonly logger = new Logger(DeviceConfigsService.name);
    private watcher: FSWatcher | null = null;
    private syncTimer: NodeJS.Timeout | null = null;
    private readonly configsCache = new Map<string, DeviceConfig | null>();

    constructor(
        @Inject(DEVICE_CONFIG_MODEL_PROVIDER_NAME)
        private readonly deviceConfigModel: Model<DeviceConfig>,
        private readonly configService: ConfigService,
        private readonly parser: DeviceConfigsParserService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    /*
     * Initialize and sync device configs from files on app start.
     * Using bootstrap phase instead of "onModuleInit" to have all event listeners registered
     */
    async onApplicationBootstrap(): Promise<void> {
        await this.syncFromDisk();
        this.startWatcher();
    }

    onModuleDestroy(): void {
        this.stopWatcher();
        if (this.syncTimer) {
            clearTimeout(this.syncTimer);
            this.syncTimer = null;
        }
    }

    getConfigsDir(): string {
        const configured = this.configService.get<string>('DEVICE_CONFIGS_DIR') ?? DEFAULT_DEVICE_CONFIGS_DIR;
        return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
    }

    async getConfig(key: DeviceConfigKey): Promise<DeviceConfig | null> {
        const cacheKey = this.hashConfigKey(key);
        if (this.configsCache.has(cacheKey)) {
            return this.configsCache.get(cacheKey);
        }
        const config = await this.deviceConfigModel.findOne(this.toConfigFilter(key)).lean<DeviceConfig>().exec();
        this.configsCache.set(cacheKey, config);
        return config;
    }

    async getConfigs(keys: Array<DeviceConfigKey>): Promise<Array<DeviceConfig>> {
        if (!keys.length) {
            return [];
        }
        return this.deviceConfigModel
            .find({ $or: keys.map(key => this.toConfigFilter(key)) })
            .lean<Array<DeviceConfig>>()
            .exec();
    }

    async syncFromDisk(filename?: string): Promise<Array<ParsedDeviceConfig>> {
        const configsDir = this.getConfigsDir();
        if (!existsSync(configsDir)) {
            this.logger.warn(`Device configs directory "${configsDir}" does not exist - skipping sync`);
            return [];
        }

        let parsedConfigs: Array<ParsedDeviceConfig>;
        if (filename) {
            parsedConfigs = await this.loadConfig(path.join(configsDir, filename));
        } else {
            parsedConfigs = await this.loadAllConfigs(configsDir);
        }

        await this.syncToDatabase(parsedConfigs);
        return parsedConfigs;
    }

    private async loadAllConfigs(configsDir: string): Promise<Array<ParsedDeviceConfig>> {
        const entries = await readdir(configsDir, { withFileTypes: true });
        const yamlFiles = entries
            .filter(entry => entry.isFile() && DEVICE_CONFIGS_FILE_EXTENSIONS.includes(extname(entry.name).toLowerCase()))
            .map(entry => join(configsDir, entry.name));

        const fileParseResults = await Promise.all(yamlFiles.map(filePath => this.loadConfig(filePath)));
        return fileParseResults.flat();
    }

    private async loadConfig(filepath: string): Promise<Array<ParsedDeviceConfig>> {
        try {
            const content = await readFile(filepath, 'utf8');
            return this.parser.parseFile(filepath, content);
        } catch (error) {
            this.logger.error(`Failed to read device config file "${filepath}": ${error.message}`);
            return [];
        }
    }

    private hashConfigKey(key: DeviceConfigKey): string {
        return `${key.brand}:${key.type}:${key.transportProtocol}`;
    }

    private toConfigFilter(key: DeviceConfigKey): DeviceConfigKey {
        return { brand: key.brand, type: key.type, transportProtocol: key.transportProtocol };
    }

    private async syncToDatabase(parsedConfigs: Array<ParsedDeviceConfig>): Promise<void> {
        const upsertedKeys = await Promise.all(parsedConfigs.map(config => this.upsertConfig(config)));
        const removed = await this.removeStaleConfigs(upsertedKeys);
        this.configsCache.clear();
        this.logger.log(`Device configs sync completed: ${upsertedKeys.length} upserted, ${removed} removed`);
        this.eventEmitter.emit(DeviceConfigsChangedEvent.eventName, new DeviceConfigsChangedEvent(parsedConfigs));
    }

    private async upsertConfig(config: ParsedDeviceConfig): Promise<DeviceConfigKey> {
        const key: DeviceConfigKey = {
            brand: config.brand,
            type: config.type,
            transportProtocol: config.transportProtocol,
        };
        await this.deviceConfigModel
            .updateOne(
                key,
                {
                    $set: {
                        strict: config.strict !== false,
                        commands: config.commands,
                        controls: config.controls,
                        measurements: config.measurements,
                    },
                    $setOnInsert: key,
                },
                { upsert: true, runValidators: true },
            )
            .exec();
        return key;
    }

    private async removeStaleConfigs(activeKeys: Array<DeviceConfigKey>): Promise<number> {
        if (activeKeys.length === 0) {
            // When no records uploaded from the files
            const result = await this.deviceConfigModel.deleteMany({}).exec();
            return result.deletedCount ?? 0;
        }
        const result = await this.deviceConfigModel
            .deleteMany({
                $nor: activeKeys.map(key => ({
                    brand: key.brand,
                    type: key.type,
                    transportProtocol: key.transportProtocol,
                })),
            })
            .exec();
        return result.deletedCount ?? 0;
    }

    private startWatcher(): void {
        const configsDir = this.getConfigsDir();
        if (!existsSync(configsDir)) {
            return;
        }
        try {
            this.watcher = watch(configsDir, { persistent: false }, (_event, filename) => {
                if (!filename || !DEVICE_CONFIGS_FILE_EXTENSIONS.includes(extname(filename).toLowerCase())) {
                    return;
                }
                this.scheduleSync(filename);
            });
            this.logger.log(`Watching device configs directory "${configsDir}" for changes`);
        } catch (error) {
            this.logger.error(`Failed to start device configs watcher: ${(error as Error).message}`);
        }
    }

    private stopWatcher(): void {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }

    private scheduleSync(filename: string): void {
        if (this.syncTimer) {
            clearTimeout(this.syncTimer);
        }
        this.syncTimer = setTimeout(() => {
            this.syncTimer = null;
            this.logger.debug(`Device configs change detected (${filename}), re-syncing`);
            this.syncFromDisk().catch(error => {
                this.logger.error(`Device configs sync failed: ${(error as Error).message}`);
            });
        }, DEVICE_CONFIGS_WATCHER_DEBOUNCE_MS);
    }
}
