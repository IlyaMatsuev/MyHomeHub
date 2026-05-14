import { Controller, Body, Param, Query, Get, Delete, Post, Put } from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiCreatedResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { DevicesService } from 'devices/devices.service';
import { Device, DeviceBrand, DevicesPage } from 'devices/interfaces';
import { CreateDeviceDto, UpdateDeviceDto } from 'devices/dto';
import { GetDevicesDto } from 'devices/dto/get-devices.dto';
import { MqttService } from 'mqtt/mqtt.service';
import { ZigbeePermitJoinDto, ZigbeeRenameDto } from 'mqtt/dto';

@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
    constructor(
        private readonly deviceService: DevicesService,
        private readonly mqttService: MqttService,
    ) {}

    @Get()
    @ApiOperation({ summary: 'Get all added devices' })
    @ApiOkResponse()
    @ApiUnauthorizedResponse()
    async getDevices(@Query() query: GetDevicesDto): Promise<DevicesPage> {
        return this.deviceService.getDevices(query);
    }

    @Get('/:externalId')
    @ApiParam({ name: 'externalId', description: 'External ID of the device to find', example: 'f3cec07c-9834-4a02-990d-28b0d99534ab' })
    @ApiOperation({ summary: 'Get a specific device by the provided external ID' })
    @ApiOkResponse()
    @ApiNotFoundResponse()
    @ApiUnauthorizedResponse()
    async getDevice(@Param('externalId') externalId: string): Promise<Device> {
        return this.deviceService.getDeviceByExternalId(externalId);
    }

    @Post()
    @ApiOperation({ summary: 'Add a new device' })
    @ApiCreatedResponse()
    @ApiBadRequestResponse()
    @ApiUnauthorizedResponse()
    async addDevice(@Body() createDeviceDto: CreateDeviceDto): Promise<Device> {
        return this.deviceService.addDevice(createDeviceDto);
    }

    @Put('/:externalId')
    @ApiParam({ name: 'externalId', description: 'External ID of the device to update', example: 'f3cec07c-9834-4a02-990d-28b0d99534ab' })
    @ApiOperation({ summary: 'Update an existing device by the provided external ID' })
    @ApiOkResponse()
    @ApiNotFoundResponse()
    @ApiBadRequestResponse()
    @ApiUnauthorizedResponse()
    async updateDevice(@Param('externalId') externalId: string, @Body() updateDeviceDto: UpdateDeviceDto): Promise<Device> {
        return this.deviceService.updateDevice(externalId, updateDeviceDto);
    }

    @Delete('/:externalId')
    @ApiParam({ name: 'externalId', description: 'External ID of the device to delete', example: 'f3cec07c-9834-4a02-990d-28b0d99534ab' })
    @ApiOperation({ summary: 'Delete an existing device by the provided external ID' })
    @ApiOkResponse()
    @ApiNotFoundResponse()
    @ApiBadRequestResponse()
    @ApiUnauthorizedResponse()
    async removeDevice(@Param('externalId') externalId: string): Promise<Device> {
        const device = await this.deviceService.getDeviceByExternalId(externalId);

        if (device.brand === DeviceBrand.Zigbee && device.zigbeeIeeeAddress) {
            await this.mqttService.removeZigbeeDevice(device.zigbeeIeeeAddress);
        }

        return this.deviceService.removeDevice(externalId);
    }

    @Post('/zigbee/permit-join')
    @ApiOperation({ summary: 'Enable or disable Zigbee permit join mode for device pairing' })
    @ApiOkResponse()
    @ApiBadRequestResponse()
    @ApiUnauthorizedResponse()
    async zigbeePermitJoin(@Body() permitJoinDto: ZigbeePermitJoinDto): Promise<void> {
        await this.mqttService.setZigbeePermitJoin(permitJoinDto.enable, permitJoinDto.seconds);
    }

    @Post('/zigbee/rename')
    @ApiOperation({ summary: 'Rename a Zigbee device in Z2M by IEEE address' })
    @ApiOkResponse()
    @ApiBadRequestResponse()
    @ApiUnauthorizedResponse()
    async zigbeeRename(@Body() renameDto: ZigbeeRenameDto): Promise<void> {
        await this.mqttService.renameZigbeeDevice(renameDto.ieeeAddress, renameDto.friendlyName);

        const device = await this.deviceService.getDevice({ zigbeeIeeeAddress: renameDto.ieeeAddress }, { strict: false });
        if (device) {
            await this.deviceService.updateDevice(device.externalId, new UpdateDeviceDto({ zigbeeFriendlyName: renameDto.friendlyName }));
        }
    }
}
