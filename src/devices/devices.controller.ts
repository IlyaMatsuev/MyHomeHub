import { Body, Controller, Delete, Get, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';
import {
    ApiInternalError,
    ApiNotFound,
    ApiOkPaginationResponse,
    ApiUnauthorized,
    ApiValidationError,
    ExternalIdParam,
} from 'common/decorators';
import { PaginationResponseDto } from 'common/dto';
import { ForRoles } from 'auth/decorators';
import { UserRole } from 'users/interfaces';
import { DevicesService } from 'devices/devices.service';
import {
    CreateDeviceDto,
    DevicePayloadDto,
    DeviceResponseDto,
    GetDeviceDto,
    GetDevicesDto,
    GetPairableDevicesDto,
    PairableDeviceResponseDto,
    PairingModeStatusResponseDto,
    ToggleDevicesPairingModeDto,
    UpdateDeviceDto,
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
    @ForRoles(UserRole.Resident)
    @ApiOperation({ summary: 'Return the list of discoverable devices that can be paired' })
    @ApiOkPaginationResponse(PairableDeviceResponseDto, 'Paginated list of discoverable devices')
    getPairableDevices(@Query() options: GetPairableDevicesDto): Promise<PaginationResponseDto<PairableDevice>> {
        return this.deviceService.getPairableDevices(options);
    }

    @Post('/discover/pair')
    @ForRoles(UserRole.Resident)
    @ApiOperation({ summary: 'Enable/disable devices pairing mode' })
    @ApiOkResponse({ type: PairingModeStatusResponseDto })
    @ApiValidationError()
    toggleDevicesPairingMode(@Body() pairingModeDto: ToggleDevicesPairingModeDto): PairingModeStatusResponseDto {
        return this.deviceService.toggleDevicePairingMode(pairingModeDto.enable, pairingModeDto.seconds);
    }

    @Get()
    @ForRoles(UserRole.Resident, UserRole.Guest)
    @ApiOperation({ summary: 'Get all added devices' })
    @ApiOkPaginationResponse(DeviceResponseDto, 'Paginated list of devices')
    async getDevices(@Query() query: GetDevicesDto): Promise<PaginationResponseDto<DeviceResponseDto>> {
        return this.deviceService.getDevices({}, query);
    }

    @Get('/:externalId')
    @ForRoles(UserRole.Resident, UserRole.Guest)
    @ApiParam({ name: 'externalId', description: 'External ID of the device to find', example: 'f3cec07c-9834-4a02-990d-28b0d99534ab' })
    @ApiOperation({ summary: 'Get a specific device by the provided external ID' })
    @ApiOkResponse({ type: DeviceResponseDto })
    async getDevice(@ExternalIdParam() externalId: string, @Query() query: GetDeviceDto): Promise<DeviceResponseDto> {
        return this.deviceService.getDevice(externalId, query);
    }

    @Post()
    @ForRoles(UserRole.Resident)
    @ApiOperation({ summary: 'Add a new device' })
    @ApiCreatedResponse({ type: DeviceResponseDto })
    @ApiValidationError()
    async addDevice(@Body() createDeviceDto: CreateDeviceDto): Promise<DeviceResponseDto> {
        return this.deviceService.addDevice(createDeviceDto);
    }

    @Put('/:externalId')
    @ForRoles(UserRole.Resident)
    @ApiParam({ name: 'externalId', description: 'External ID of the device to update', example: 'f3cec07c-9834-4a02-990d-28b0d99534ab' })
    @ApiOperation({ summary: 'Update an existing device by the provided external ID' })
    @ApiOkResponse({ type: DeviceResponseDto })
    @ApiValidationError()
    async updateDevice(@ExternalIdParam() externalId: string, @Body() updateDeviceDto: UpdateDeviceDto): Promise<DeviceResponseDto> {
        return this.deviceService.updateDevice(externalId, updateDeviceDto);
    }

    @Post('/:externalId/command')
    @ForRoles(UserRole.Resident, UserRole.Guest)
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
    async sendCommand(@ExternalIdParam() externalId: string, @Body() commandDto: DevicePayloadDto): Promise<DeviceResponseDto> {
        return this.deviceService.sendCommand(externalId, commandDto);
    }

    @Delete('/:externalId')
    @ForRoles(UserRole.Resident)
    @ApiParam({ name: 'externalId', description: 'External ID of the device to delete', example: 'f3cec07c-9834-4a02-990d-28b0d99534ab' })
    @ApiOperation({ summary: 'Delete an existing device by the provided external ID' })
    @ApiOkResponse({ type: DeviceResponseDto })
    @ApiValidationError()
    async removeDevice(@ExternalIdParam() externalId: string): Promise<DeviceResponseDto> {
        return this.deviceService.removeDevice(externalId);
    }
}
