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
import { Device, PairingModeStatus } from 'devices/interfaces';
import {
    CreateDeviceDto,
    DevicePayloadDto,
    DeviceResponseDto,
    GetPairableDevicesDto,
    PairableDeviceResponseDto,
    UpdateDeviceDto,
    GetDevicesDto,
    ToggleDevicesPairingModeDto,
} from 'devices/dto';
import { ApiPaginationResponse, PaginationResponseDto } from 'common/dto';
import { PairableDevice } from 'zigbee/interfaces';

@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
    constructor(private readonly deviceService: DevicesService) {}

    @Get('/discover')
    @ApiOperation({ summary: 'Return the list of discoverable devices that can be paired' })
    @ApiPaginationResponse(PairableDeviceResponseDto)
    @ApiBadRequestResponse()
    @ApiUnauthorizedResponse()
    getPairableDevices(@Query() options: GetPairableDevicesDto): Promise<PaginationResponseDto<PairableDevice>> {
        return this.deviceService.getPairableDevices(options);
    }

    @Post('/discover/pair')
    @ApiOperation({ summary: 'Enable/disable devices pairing mode' })
    @ApiOkResponse()
    @ApiBadRequestResponse()
    @ApiUnauthorizedResponse()
    toggleDevicesPairingMode(@Body() pairingModeDto: ToggleDevicesPairingModeDto): PairingModeStatus {
        return this.deviceService.toggleDevicePairingMode(pairingModeDto.enable, pairingModeDto.seconds);
    }

    @Get()
    @ApiOperation({ summary: 'Get all added devices' })
    @ApiPaginationResponse(DeviceResponseDto)
    @ApiUnauthorizedResponse()
    async getDevices(@Query() query: GetDevicesDto): Promise<PaginationResponseDto<Device>> {
        return this.deviceService.getDevices({}, query);
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

    @Post('/:externalId/command')
    @ApiParam({
        name: 'externalId',
        description: 'External ID of the device to send the command to',
        example: 'f3cec07c-9834-4a02-990d-28b0d99534ab',
    })
    @ApiOperation({
        summary: 'Send a stateless command to a device. Similar to controls/measurements but does not save the state on device',
    })
    @ApiOkResponse()
    @ApiNotFoundResponse()
    @ApiBadRequestResponse()
    @ApiUnauthorizedResponse()
    async sendCommand(@Param('externalId') externalId: string, @Body() commandDto: DevicePayloadDto): Promise<Device> {
        return this.deviceService.sendCommand(externalId, commandDto);
    }

    @Delete('/:externalId')
    @ApiParam({ name: 'externalId', description: 'External ID of the device to delete', example: 'f3cec07c-9834-4a02-990d-28b0d99534ab' })
    @ApiOperation({ summary: 'Delete an existing device by the provided external ID' })
    @ApiOkResponse()
    @ApiNotFoundResponse()
    @ApiBadRequestResponse()
    @ApiUnauthorizedResponse()
    async removeDevice(@Param('externalId') externalId: string): Promise<Device> {
        return this.deviceService.removeDevice(externalId);
    }
}
