import { createSocket, RemoteInfo, Socket } from 'node:dgram';
import { networkInterfaces } from 'node:os';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_PORT, DEFAULT_SERVER_LABEL } from 'common/common.constants';
import { ServerDto } from 'discovery/dto';
import { DEFAULT_DISCOVERY_MESSAGE, DEFAULT_UDP_PORT } from 'discovery/discovery.constants';

@Injectable()
export class DiscoveryService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(DiscoveryService.name);
    private socket: Socket;

    constructor(private readonly configService: ConfigService) {}

    onModuleInit(): void {
        this.startUdpListener();
    }

    onModuleDestroy(): void {
        this.stopUdpListener();
    }

    getServerInfo(): ServerDto {
        return {
            label: this.getServerLabel(),
            address: this.getServerAddress(),
            port: this.getServerPort(),
        };
    }

    private startUdpListener(): void {
        const udpPort = this.getUdpPort();
        const discoveryMessage = this.getDiscoveryMessage();

        this.socket = createSocket({ type: 'udp4', reuseAddr: true });

        this.socket.on('error', err => {
            this.logger.error(`UDP socket error: ${err.message}`);
            this.socket.close();
        });

        this.socket.on('message', (msg: Buffer, remoteInfo: RemoteInfo) => {
            const message = msg.toString().trim();
            this.logger.debug(`Received discovery message "${message} from "${remoteInfo.address}:${remoteInfo.port}"`);
            if (message === discoveryMessage) {
                this.logger.debug(`Discovery request from ${remoteInfo.address}:${remoteInfo.port}`);
                this.sendDiscoveryResponse(remoteInfo);
            }
        });

        this.socket.on('listening', () => {
            const address = this.socket.address();
            this.logger.log(`UDP discovery listener started on port ${address.port}`);
        });

        this.socket.bind(udpPort, () => {
            this.socket.setBroadcast(true);
        });
    }

    private stopUdpListener(): void {
        if (this.socket) {
            this.socket.close();
            this.logger.log('UDP discovery listener stopped');
        }
    }

    private sendDiscoveryResponse(remoteInfo: RemoteInfo): void {
        const response = JSON.stringify(this.getServerInfo());
        const responseBuffer = Buffer.from(response);

        this.socket.send(responseBuffer, 0, responseBuffer.length, remoteInfo.port, remoteInfo.address, err => {
            if (err) {
                this.logger.error(`Failed to send discovery response: ${err.message}`);
            } else {
                this.logger.debug(`Discovery response sent to ${remoteInfo.address}:${remoteInfo.port}`);
            }
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

    private getUdpPort(): number {
        return Number(this.configService.get<string>('UDP_PORT') ?? DEFAULT_UDP_PORT);
    }

    private getDiscoveryMessage(): string {
        return this.configService.get<string>('DISCOVERY_MESSAGE') ?? DEFAULT_DISCOVERY_MESSAGE;
    }
}
