import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
    ApiOkPaginationResponse,
    ApiInternalError,
    ApiNotFound,
    ApiUnauthorized,
    ApiValidationError,
    ExternalIdParam,
    ApiForbidden,
} from 'common/decorators';
import { PaginationResponseDto } from 'common/dto';
import { Public } from 'auth/decorators';
import { StrictThrottle } from 'throttler/decorators';
import { RegistrationRequestsService } from 'users/registration-requests.service';
import {
    CreateRegistrationRequestDto,
    GetRegistrationRequestsDto,
    RegistrationRequestResponseDto,
    UpdateRegistrationRequestDto,
} from 'users/dto';

@Controller('auth/register/requests')
@ApiTags('Auth')
@ApiInternalError()
export class RegistrationRequestsController {
    constructor(private readonly registrationRequestsService: RegistrationRequestsService) {}

    // TODO: When creating a registration request, I need to respond with some kind of JWT token with a baked in request id
    //  Then, when trying to get request, I need to provide this token and check the user for which it was made in the guards
    //  To exclude the possibility to guess external id of request of the users
    @Public()
    @Get('/:externalId')
    @ApiParam({
        name: 'externalId',
        description: 'The external ID of the registration request, provided after creating the request',
        example: 'f3cec07c-9834-4a02-990d-28b0d99534ab',
    })
    @ApiOperation({ summary: 'Get a registration request by external ID' })
    @ApiOkResponse({ type: RegistrationRequestResponseDto })
    @ApiNotFound('registration request')
    async getRequest(@ExternalIdParam() externalId: string): Promise<RegistrationRequestResponseDto> {
        return new RegistrationRequestResponseDto(
            await this.registrationRequestsService.getRequestByExternalId(externalId, { strict: true }),
        );
    }

    @Get()
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get all registration requests' })
    @ApiOkPaginationResponse(RegistrationRequestResponseDto, 'Paginated list of registration requests')
    @ApiUnauthorized()
    getRequests(@Query() query: GetRegistrationRequestsDto): Promise<PaginationResponseDto<RegistrationRequestResponseDto>> {
        return this.registrationRequestsService.getRequests(query);
    }

    @Public()
    @Post()
    @StrictThrottle('registrationRequest')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Submit a new registration request' })
    @ApiOkResponse({ type: RegistrationRequestResponseDto })
    @ApiValidationError()
    @ApiForbidden()
    createRequest(@Body() dto: CreateRegistrationRequestDto): Promise<RegistrationRequestResponseDto> {
        return this.registrationRequestsService.createRequest(dto);
    }

    @Put('/:externalId')
    @ApiBearerAuth()
    @ApiParam({
        name: 'externalId',
        description: 'The external ID of the registration request',
        example: 'f3cec07c-9834-4a02-990d-28b0d99534ab',
    })
    @ApiOperation({ summary: 'Approve or reject a registration request' })
    @ApiOkResponse({ type: RegistrationRequestResponseDto })
    @ApiNotFound('registration request')
    @ApiUnauthorized()
    @ApiValidationError()
    updateRequest(
        @ExternalIdParam() externalId: string,
        @Body() dto: UpdateRegistrationRequestDto,
    ): Promise<RegistrationRequestResponseDto> {
        return this.registrationRequestsService.updateRequest(externalId, dto);
    }
}
