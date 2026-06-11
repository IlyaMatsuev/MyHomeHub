import { createSocket, RemoteInfo, Socket } from 'node:dgram';
import { networkInterfaces } from 'node:os';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServerInfoDto } from './dto';

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

    getServerInfo(): ServerInfoDto {
        return {
            label: this.getServerLabel(),
            address: this.getLocalIpAddress(),
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

        this.socket.on('message', (msg: Buffer, rinfo: RemoteInfo) => {
            const message = msg.toString().trim();
            if (message === discoveryMessage) {
                this.logger.debug(`Discovery request from ${rinfo.address}:${rinfo.port}`);
                this.sendDiscoveryResponse(rinfo);
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

    private sendDiscoveryResponse(rinfo: RemoteInfo): void {
        const response = JSON.stringify(this.getServerInfo());
        const responseBuffer = Buffer.from(response);

        this.socket.send(responseBuffer, 0, responseBuffer.length, rinfo.port, rinfo.address, err => {
            if (err) {
                this.logger.error(`Failed to send discovery response: ${err.message}`);
            } else {
                this.logger.debug(`Discovery response sent to ${rinfo.address}:${rinfo.port}`);
            }
        });
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
        return this.configService.get<string>('SERVER_LABEL') ?? 'SmartHome Hub';
    }

    private getServerPort(): number {
        return Number(this.configService.get<string>('PORT') ?? process.env.PORT ?? 3000);
    }

    private getUdpPort(): number {
        return Number(this.configService.get<string>('DISCOVERY_UDP_PORT') ?? 5353);
    }

    private getDiscoveryMessage(): string {
        return this.configService.get<string>('DISCOVERY_MESSAGE') ?? 'SMARTHOME_DISCOVER';
    }
}
