import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';
import { ApiInternalError, ApiNotFound, ApiUnauthorized, ApiValidationError } from 'common/decorators';
import { ApiOkPaginationResponse, PaginationResponseDto } from 'common/dto';
import { Public } from 'auth/decorators';
import { RegistrationRequestsService } from 'users/registration-requests.service';
import {
    CreateRegistrationRequestDto,
    GetRegistrationRequestsDto,
    RegistrationRequestResponseDto,
    UpdateRegistrationRequestDto,
} from 'users/dto';

@Controller('auth/register/requests')
@ApiUnauthorized()
@ApiInternalError()
export class RegistrationRequestsController {
    constructor(private readonly registrationRequestsService: RegistrationRequestsService) {}

    @Public()
    @Post()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Submit a new registration request' })
    @ApiOkResponse({ type: RegistrationRequestResponseDto })
    @ApiValidationError()
    createRequest(@Body() dto: CreateRegistrationRequestDto): Promise<RegistrationRequestResponseDto> {
        return this.registrationRequestsService.createRequest(dto);
    }

    @Public()
    @Get('/:requestExternalIdOrUserEmail')
    @ApiParam({
        name: 'requestExternalIdOrUserEmail',
        description: 'The external ID or email address of the registration request',
        example: 'f3cec07c-9834-4a02-990d-28b0d99534ab',
    })
    @ApiOperation({ summary: 'Get a registration request by external ID or email' })
    @ApiOkResponse({ type: RegistrationRequestResponseDto })
    @ApiNotFound('registration request')
    getRequest(@Param('requestExternalIdOrUserEmail') requestExternalIdOrUserEmail: string): Promise<RegistrationRequestResponseDto> {
        return this.registrationRequestsService.getRequest(requestExternalIdOrUserEmail);
    }

    @Put('/:requestExternalIdOrUserEmail')
    @ApiBearerAuth()
    @ApiParam({
        name: 'requestExternalIdOrUserEmail',
        description: 'The external ID or email address of the registration request',
        example: 'f3cec07c-9834-4a02-990d-28b0d99534ab',
    })
    @ApiOperation({ summary: 'Approve or reject a registration request' })
    @ApiOkResponse({ type: RegistrationRequestResponseDto })
    @ApiNotFound('registration request')
    @ApiValidationError()
    updateRequest(
        @Param('requestExternalIdOrUserEmail') requestExternalIdOrUserEmail: string,
        @Body() dto: UpdateRegistrationRequestDto,
    ): Promise<RegistrationRequestResponseDto> {
        return this.registrationRequestsService.updateRequest(requestExternalIdOrUserEmail, dto);
    }

    @Get()
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get all registration requests' })
    @ApiOkPaginationResponse(RegistrationRequestResponseDto, 'Paginated list of registration requests')
    getRequests(@Query() query: GetRegistrationRequestsDto): Promise<PaginationResponseDto<RegistrationRequestResponseDto>> {
        return this.registrationRequestsService.getRequests(query);
    }
}
