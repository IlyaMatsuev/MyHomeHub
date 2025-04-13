import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    WsException,
} from '@nestjs/websockets';
import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { v4 as uuid } from 'uuid';
import { DevicesService } from 'devices/devices.service';
import { Device, DeviceGatewayEvent, DeviceGatewayResponse } from 'devices/interfaces';
import { UpdateDeviceDto, UpdateDeviceStateDto } from 'devices/dto';
import { UseFilters, UseInterceptors } from '@nestjs/common';
import { WsExceptionFilter } from 'common/filters/ws-exception.filter';
import { GlobalInterceptor } from 'common/interceptors';
import { ConfigService } from '@nestjs/config';

interface WebSocketClient extends WebSocket {
    id: string;
}

@UseFilters(WsExceptionFilter)
@UseInterceptors(GlobalInterceptor)
@WebSocketGateway({ cors: { origin: '*' }, transports: ['websocket'] })
export class DevicesGateway implements OnGatewayConnection, OnGatewayDisconnect {
    clients: Map<string, WebSocketClient> = new Map();
    pairedDevices: Map<string, Device> = new Map();

    @WebSocketServer()
    server: WSServer;

    constructor(
        private readonly configService: ConfigService,
        private readonly devicesService: DevicesService,
    ) {}

    handleConnection(@ConnectedSocket() client: WebSocketClient) {
        const clientId = uuid();
        client.id = clientId;
        this.clients.set(clientId, client);
    }

    handleDisconnect(@ConnectedSocket() client: WebSocketClient) {
        this.clients.delete(client.id);
    }

    @SubscribeMessage('pair')
    async onDevicePairing(
        @ConnectedSocket() client: WebSocketClient,
        @MessageBody('id') externalId: string,
        @MessageBody('key') key: string,
    ): Promise<DeviceGatewayResponse> {
        if (!this.clients.has(client.id)) {
            throw new WsException('WebSocket client was not recognized');
        }
        if (this.pairedDevices.has(client.id)) {
            throw new WsException('The device has already been paired');
        }
        if (!this.deviceAccessKeyValid(key)) {
            throw new WsException('Device access key is not valid');
        }
        const device = await this.devicesService.getDeviceByExternalId(externalId, { strict: false });
        if (!device) {
            throw new WsException(`There is no device with the provided external id: ${externalId}`);
        }
        this.pairedDevices.set(client.id, device);
        return {
            event: DeviceGatewayEvent.Pair,
            data: {
                success: true,
                updateInterval: device.updateInterval,
            },
        };
    }

    @SubscribeMessage('state')
    async onDeviceStateUpdate(
        @ConnectedSocket() client: WebSocketClient,
        @MessageBody() stateDto: UpdateDeviceStateDto,
    ): Promise<DeviceGatewayResponse> {
        if (!this.clients.has(client.id) || !this.pairedDevices.has(client.id)) {
            throw new WsException('WebSocket client was not recognized');
        }

        const device = this.pairedDevices.get(client.id);
        await this.devicesService.updateDevice(device.externalId, new UpdateDeviceDto(stateDto.controls, stateDto.measurements));
        return {
            event: DeviceGatewayEvent.State,
            data: {
                success: true,
                updateInterval: device.updateInterval,
            },
        };
    }

    private deviceAccessKeyValid(key: string): boolean {
        const actualKey = this.configService.get<string>('DEVICE_ACCESS_KEY');
        return key === actualKey;
    }
}
