import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';
import { PaginationResponseDto } from 'common/dto';
import {
    ApiInternalError,
    ApiNotFound,
    ApiOkPaginationResponse,
    ApiUnauthorized,
    ApiValidationError,
    ExternalIdParam,
} from 'common/decorators';
import { ForRoles } from 'auth/decorators';
import { UserRole } from 'users/interfaces';
import { ScenariosService } from 'scenarios/scenarios.service';
import { ScenarioGroupsService } from 'scenarios/scenario-groups.service';
import {
    CreateScenarioDto,
    DeleteScenarioGroupDto,
    GetScenarioGroupsDto,
    GetScenariosDto,
    ScenarioGroupResponseDto,
    ScenarioResponseDto,
    UpdateScenarioDto,
} from 'scenarios/dto';

@ApiBearerAuth()
@Controller('scenarios')
@ApiUnauthorized()
@ApiNotFound('scenario')
@ApiInternalError()
export class ScenariosController {
    constructor(
        private readonly scenariosService: ScenariosService,
        private readonly scenarioGroupsService: ScenarioGroupsService,
    ) {}

    @Get('/groups')
    @ForRoles(UserRole.Resident, UserRole.Guest)
    @ApiOperation({ summary: 'Get all scenario groups' })
    @ApiOkPaginationResponse(ScenarioGroupResponseDto, 'Paginated list of scenario groups')
    @ApiNotFound('scenario group')
    async getGroups(@Query() query: GetScenarioGroupsDto): Promise<PaginationResponseDto<ScenarioGroupResponseDto>> {
        return this.scenarioGroupsService.getGroups(query);
    }

    @Get('/groups/:name')
    @ForRoles(UserRole.Resident, UserRole.Guest)
    @ApiParam({
        name: 'name',
        description: 'Name of the scenario group',
        example: 'outside_lights',
    })
    @ApiOperation({ summary: 'Get scenario group by name' })
    @ApiOkResponse({ type: ScenarioGroupResponseDto })
    @ApiNotFound('scenario group')
    async getGroup(@Param('name') name: string): Promise<ScenarioGroupResponseDto> {
        return this.scenarioGroupsService.getGroupByName(name);
    }

    @Post('/groups/:name')
    @ForRoles(UserRole.Resident)
    @ApiParam({
        name: 'name',
        description: 'Name of the scenario group to create',
        example: 'outside_lights',
    })
    @ApiOperation({ summary: 'Create a new scenario group' })
    @ApiOkResponse({ type: ScenarioGroupResponseDto })
    @ApiNotFound('scenario group')
    @ApiValidationError()
    async createGroup(@Param('name') name: string): Promise<ScenarioGroupResponseDto> {
        return this.scenarioGroupsService.createGroup(name);
    }

    @Delete('/groups/:name')
    @ForRoles(UserRole.Resident)
    @ApiParam({
        name: 'name',
        description: 'Name of the scenario group to delete',
        example: 'outside_lights',
    })
    @ApiOperation({ summary: 'Delete a scenario group by name' })
    @ApiOkResponse({ type: ScenarioGroupResponseDto })
    @ApiValidationError()
    @ApiNotFound('scenario group')
    async deleteGroup(@Param('name') name: string, @Query() query: DeleteScenarioGroupDto): Promise<ScenarioGroupResponseDto> {
        return this.scenarioGroupsService.deleteGroup(name, query.deleteScenarios);
    }

    @Get()
    @ForRoles(UserRole.Resident, UserRole.Guest)
    @ApiOperation({ summary: 'Get all added scenarios' })
    @ApiOkPaginationResponse(ScenarioResponseDto, 'Paginated list of scenarios')
    async getScenarios(@Query() query: GetScenariosDto): Promise<PaginationResponseDto<ScenarioResponseDto>> {
        return this.scenariosService.getScenarios(query);
    }

    @Get('/:externalId')
    @ForRoles(UserRole.Resident, UserRole.Guest)
    @ApiParam({ name: 'externalId', description: 'External ID of the scenario to find', example: 'f3cec07c-9834-4a02-990d-28b0d99534ab' })
    @ApiOperation({ summary: 'Get a specific scenario by the provided external ID' })
    @ApiOkResponse({ type: ScenarioResponseDto })
    async getScenario(@ExternalIdParam() externalId: string): Promise<ScenarioResponseDto> {
        return this.scenariosService.getScenarioByExternalId(externalId);
    }

    @Post()
    @ForRoles(UserRole.Resident)
    @ApiOperation({ summary: 'Add a new scenario' })
    @ApiCreatedResponse({ type: ScenarioResponseDto })
    @ApiValidationError()
    async addScenario(@Body() createScenarioDto: CreateScenarioDto): Promise<ScenarioResponseDto> {
        return this.scenariosService.addScenario(createScenarioDto);
    }

    @Put('/:externalId')
    @ForRoles(UserRole.Resident)
    @ApiParam({ name: 'externalId', description: 'External ID of the scenario to update', example: 'f3cec07c-9834-4a02-990d-28b0d99534ab' })
    @ApiOperation({ summary: 'Update an existing scenario by the provided external ID' })
    @ApiOkResponse({ type: ScenarioResponseDto })
    @ApiValidationError()
    async updateScenario(
        @ExternalIdParam() externalId: string,
        @Body() updateScenarioDto: UpdateScenarioDto,
    ): Promise<ScenarioResponseDto> {
        return this.scenariosService.updateScenario(externalId, updateScenarioDto);
    }

    @Delete('/:externalId')
    @ForRoles(UserRole.Resident)
    @ApiParam({ name: 'externalId', description: 'External ID of the scenario to delete', example: 'f3cec07c-9834-4a02-990d-28b0d99534ab' })
    @ApiOperation({ summary: 'Delete an existing scenario by the provided external ID' })
    @ApiOkResponse({ type: ScenarioResponseDto })
    @ApiValidationError()
    async removeScenario(@ExternalIdParam() externalId: string): Promise<ScenarioResponseDto> {
        return this.scenariosService.removeScenario(externalId);
    }
}
