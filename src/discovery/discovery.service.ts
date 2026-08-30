import { networkInterfaces } from 'node:os';
import { Bonjour, Service } from 'bonjour-service';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_PORT, DEFAULT_SERVER_LABEL } from 'common/common.constants';
import { ServerDto } from 'discovery/dto';
import { DEFAULT_SERVER_MDNS_SERVICE_TYPE, MDNS_SERVICE_PROTOCOL } from 'discovery/discovery.constants';

@Injectable()
export class DiscoveryService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(DiscoveryService.name);
    private bonjour: Bonjour;
    private service: Service;

    constructor(private readonly configService: ConfigService) {}

    onModuleInit(): void {
        this.startMdnsAdvertisement();
    }

    onModuleDestroy(): Promise<void> {
        return this.stopMdnsAdvertisement();
    }

    getServerInfo(): ServerDto {
        return {
            label: this.getServerLabel(),
            address: this.getServerAddress(),
            port: this.getServerPort(),
        };
    }

    private startMdnsAdvertisement(): void {
        if (!this.isServerDiscoverable()) {
            this.logger.log('mDNS advertisement is disabled');
            return;
        }

        const serverInfo = this.getServerInfo();

        this.bonjour = new Bonjour(undefined, (err: Error) => {
            this.logger.error(`mDNS responder error: ${err.message}`);
        });

        this.service = this.bonjour.publish({
            name: this.getServerLabel(),
            type: this.getServerMdnsServiceType(),
            protocol: MDNS_SERVICE_PROTOCOL,
            port: serverInfo.port,
            txt: {
                label: serverInfo.label,
                address: serverInfo.address,
                port: String(serverInfo.port),
            },
        });

        this.service.on('error', (err: Error) => {
            this.logger.error(`Failed to advertise the mDNS service: ${err.message}`);
        });

        this.service.on('up', () => {
            this.logger.log(`mDNS advertisement started for "${this.service.fqdn}" on port ${serverInfo.port}`);
        });
    }

    private stopMdnsAdvertisement(): Promise<void> {
        if (!this.bonjour) {
            return Promise.resolve();
        }

        return new Promise<void>(resolve => {
            this.bonjour.unpublishAll(() => {
                this.bonjour.destroy(() => {
                    this.bonjour = undefined;
                    this.service = undefined;
                    this.logger.log('mDNS advertisement stopped');
                    resolve();
                });
            });
        });
    }

    private getServerAddress(): string {
        return this.configService.get<string>('SERVER_EXTERNAL_ADDRESS') || this.getLocalIpAddress();
    }

    private getLocalIpAddress(): string {
        const interfaces = networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
        return '127.0.0.1';
    }

    private getServerLabel(): string {
        return this.configService.get<string>('SERVER_LABEL') ?? DEFAULT_SERVER_LABEL;
    }

    private getServerPort(): number {
        const externalPort = this.configService.get<string>('SERVER_EXTERNAL_PORT');
        if (externalPort) {
            return Number(externalPort);
        }
        return Number(this.configService.get<string>('PORT') ?? DEFAULT_PORT);
    }

    private isServerDiscoverable(): boolean {
        return this.configService.get<string>('SERVER_DISCOVERY_ENABLED') === 'true';
    }

    private getServerMdnsServiceType(): string {
        return this.configService.get<string>('SERVER_MDNS_SERVICE_TYPE') ?? DEFAULT_SERVER_MDNS_SERVICE_TYPE;
    }
}
