import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer, WsException,
} from '@nestjs/websockets';
import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { v4 as uuid } from 'uuid';
import { DevicesService } from 'devices/devices.service';
import { Device, DeviceGatewayEvent, DeviceGatewayResponse } from 'devices/interfaces';
import { UpdateDeviceStateDto } from 'devices/dto';
import { UseFilters } from '@nestjs/common';
import { WsExceptionFilter } from 'common/ws-exception.filter';
import { ConfigService } from '@nestjs/config';

@UseFilters(new WsExceptionFilter())
@WebSocketGateway({
    cors: { origin: '*' },
    transports: ['websocket'],
})
export class DevicesGateway implements OnGatewayConnection, OnGatewayDisconnect {
    clients: Map<string, WebSocket> = new Map();
    pairedDevices: Map<string, Device> = new Map();

    @WebSocketServer()
    server: WSServer;

    constructor(
        private readonly configService: ConfigService,
        private readonly devicesService: DevicesService
    ) {}

    handleConnection(@ConnectedSocket() client: WebSocket) {
        const clientId = uuid();
        client['id'] = clientId;
        this.clients.set(clientId, client);
    }

    handleDisconnect(@ConnectedSocket() client: WebSocket) {
        this.clients.delete(client['id']);
    }

    @SubscribeMessage('pair')
    onDevicePairing(@ConnectedSocket() client: WebSocket, @MessageBody('id') id: string, @MessageBody('key') key: string): DeviceGatewayResponse {
        if (!this.clients.has(client['id'])) {
            throw new WsException('WebSocket client was not recognized');
        }
        if (this.pairedDevices.has(client['id'])) {
            throw new WsException('The device has already been paired');
        }
        if (!this.deviceAccessKeyValid(key)) {
            throw new WsException('Device access key is not valid');
        }
        const device = this.devicesService.getDevice(id);
        if (!device) {
            throw new WsException(`There is no device with the provided id: ${id}`);
        }
        this.pairedDevices.set(client['id'], device);
        return {
            event: DeviceGatewayEvent.Pair,
            data: {
                success: true,
                updateInterval: device.updateInterval,
            },
        };
    }

    @SubscribeMessage('state')
    onDeviceStateUpdate(@ConnectedSocket() client: WebSocket, @MessageBody() stateDto: UpdateDeviceStateDto): DeviceGatewayResponse  {
        if (!this.clients.has(client['id']) || !this.pairedDevices.has(client['id'])) {
            throw new WsException('WebSocket client was not recognized');
        }

        const device = this.pairedDevices.get(client['id']);
        this.devicesService.updateDevice(device.id, stateDto);
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
