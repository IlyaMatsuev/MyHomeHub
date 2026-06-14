import { Controller, Body, Param, Query, Get, Delete, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';
import { ApiOkPaginationResponse, ApiInternalError, ApiNotFound, ApiUnauthorized, ApiValidationError } from 'common/decorators';
import { PaginationResponseDto } from 'common/dto';
import { DevicesService } from 'devices/devices.service';
import {
    CreateDeviceDto,
    DevicePayloadDto,
    DeviceResponseDto,
    GetPairableDevicesDto,
    PairableDeviceResponseDto,
    UpdateDeviceDto,
    GetDevicesDto,
    ToggleDevicesPairingModeDto,
    PairingModeStatusResponseDto,
} from 'devices/dto';
import { PairableDevice } from 'zigbee/interfaces';

@Controller('devices')
@ApiBearerAuth()
@ApiUnauthorized()
@ApiNotFound('device')
@ApiInternalError()
export class DevicesController {
    constructor(private readonly deviceService: DevicesService) {}

    @Get('/discover')
    @ApiOperation({ summary: 'Return the list of discoverable devices that can be paired' })
    @ApiOkPaginationResponse(PairableDeviceResponseDto, 'Paginated list of discoverable devices')
    getPairableDevices(@Query() options: GetPairableDevicesDto): Promise<PaginationResponseDto<PairableDevice>> {
        return this.deviceService.getPairableDevices(options);
    }

    @Post('/discover/pair')
    @ApiOperation({ summary: 'Enable/disable devices pairing mode' })
    @ApiOkResponse({ type: PairingModeStatusResponseDto })
    @ApiValidationError()
    toggleDevicesPairingMode(@Body() pairingModeDto: ToggleDevicesPairingModeDto): PairingModeStatusResponseDto {
        return this.deviceService.toggleDevicePairingMode(pairingModeDto.enable, pairingModeDto.seconds);
    }

    @Get()
    @ApiOperation({ summary: 'Get all added devices' })
    @ApiOkPaginationResponse(DeviceResponseDto, 'Paginated list of devices')
    async getDevices(@Query() query: GetDevicesDto): Promise<PaginationResponseDto<DeviceResponseDto>> {
        return this.deviceService.getDevices({}, query);
    }

    @Get('/:externalId')
    @ApiParam({ name: 'externalId', description: 'External ID of the device to find', example: 'f3cec07c-9834-4a02-990d-28b0d99534ab' })
    @ApiOperation({ summary: 'Get a specific device by the provided external ID' })
    @ApiOkResponse({ type: DeviceResponseDto })
    async getDevice(@Param('externalId') externalId: string): Promise<DeviceResponseDto> {
        return this.deviceService.getDeviceByExternalId(externalId);
    }

    @Post()
    @ApiOperation({ summary: 'Add a new device' })
    @ApiCreatedResponse({ type: DeviceResponseDto })
    @ApiValidationError()
    async addDevice(@Body() createDeviceDto: CreateDeviceDto): Promise<DeviceResponseDto> {
        return this.deviceService.addDevice(createDeviceDto);
    }

    @Put('/:externalId')
    @ApiParam({ name: 'externalId', description: 'External ID of the device to update', example: 'f3cec07c-9834-4a02-990d-28b0d99534ab' })
    @ApiOperation({ summary: 'Update an existing device by the provided external ID' })
    @ApiOkResponse({ type: DeviceResponseDto })
    @ApiValidationError()
    async updateDevice(@Param('externalId') externalId: string, @Body() updateDeviceDto: UpdateDeviceDto): Promise<DeviceResponseDto> {
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
    @ApiOkResponse({ type: DeviceResponseDto })
    @ApiValidationError()
    async sendCommand(@Param('externalId') externalId: string, @Body() commandDto: DevicePayloadDto): Promise<DeviceResponseDto> {
        return this.deviceService.sendCommand(externalId, commandDto);
    }

    @Delete('/:externalId')
    @ApiParam({ name: 'externalId', description: 'External ID of the device to delete', example: 'f3cec07c-9834-4a02-990d-28b0d99534ab' })
    @ApiOperation({ summary: 'Delete an existing device by the provided external ID' })
    @ApiOkResponse({ type: DeviceResponseDto })
    @ApiValidationError()
    async removeDevice(@Param('externalId') externalId: string): Promise<DeviceResponseDto> {
        return this.deviceService.removeDevice(externalId);
    }
}
