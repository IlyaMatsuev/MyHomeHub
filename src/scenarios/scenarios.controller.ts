import { Body, Controller, Param, Query, Delete, Get, Post, Put } from '@nestjs/common';
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
import { ScenariosService } from 'scenarios/scenarios.service';
import { ScenarioGroupsService } from 'scenarios/scenario-groups.service';
import { Scenario, ScenarioGroup } from 'scenarios/interfaces';
import { CreateScenarioDto, DeleteScenarioGroupDto, GetScenarioGroupsDto, GetScenariosDto, UpdateScenarioDto } from 'scenarios/dto';
import { PaginationResponse } from 'common/dto';

@ApiBearerAuth()
@Controller('scenarios')
export class ScenariosController {
    constructor(
        private readonly scenariosService: ScenariosService,
        private readonly scenarioGroupsService: ScenarioGroupsService,
    ) {}

    @Get()
    @ApiOperation({ summary: 'Get all added scenarios' })
    @ApiOkResponse({ description: 'Paginated list of scenarios' })
    @ApiUnauthorizedResponse()
    async getScenarios(@Query() query: GetScenariosDto): Promise<PaginationResponse<Scenario>> {
        return this.scenariosService.getScenarios(query);
    }

    @Get('/groups')
    @ApiOperation({ summary: 'Get all scenario groups' })
    @ApiOkResponse({ description: 'Paginated list of scenario groups' })
    @ApiUnauthorizedResponse()
    async getGroups(@Query() query: GetScenarioGroupsDto): Promise<PaginationResponse<ScenarioGroup>> {
        return this.scenarioGroupsService.getGroups(query);
    }

    @Get('/groups/:name')
    @ApiParam({
        name: 'name',
        description: 'Name of the scenario group',
        example: 'outside_lights',
    })
    @ApiOperation({ summary: 'Get scenario group by name' })
    @ApiOkResponse()
    @ApiNotFoundResponse()
    @ApiBadRequestResponse()
    @ApiUnauthorizedResponse()
    async getGroup(@Param('name') name: string): Promise<ScenarioGroup> {
        return this.scenarioGroupsService.getGroupByName(name);
    }

    @Post('/groups/:name')
    @ApiParam({
        name: 'name',
        description: 'Name of the scenario group to create',
        example: 'outside_lights',
    })
    @ApiOperation({ summary: 'Create a new scenario group' })
    @ApiOkResponse()
    @ApiNotFoundResponse()
    @ApiBadRequestResponse()
    @ApiUnauthorizedResponse()
    async createGroup(@Param('name') name: string): Promise<ScenarioGroup> {
        return this.scenarioGroupsService.createGroup(name);
    }

    @Delete('/groups/:name')
    @ApiParam({
        name: 'name',
        description: 'Name of the scenario group to delete',
        example: 'outside_lights',
    })
    @ApiOperation({ summary: 'Delete a scenario group by name' })
    @ApiOkResponse()
    @ApiNotFoundResponse()
    @ApiBadRequestResponse()
    @ApiUnauthorizedResponse()
    async deleteGroup(@Param('name') name: string, @Query() query: DeleteScenarioGroupDto): Promise<ScenarioGroup> {
        return this.scenarioGroupsService.deleteGroup(name, query.deleteScenarios);
    }

    @Get('/:externalId')
    @ApiParam({ name: 'externalId', description: 'External ID of the scenario to find', example: 'f3cec07c-9834-4a02-990d-28b0d99534ab' })
    @ApiOperation({ summary: 'Get a specific scenario by the provided external ID' })
    @ApiOkResponse()
    @ApiNotFoundResponse()
    @ApiUnauthorizedResponse()
    async getScenario(@Param('externalId') externalId: string): Promise<Scenario> {
        return this.scenariosService.getScenarioByExternalId(externalId);
    }

    @Post()
    @ApiOperation({ summary: 'Add a new scenario' })
    @ApiCreatedResponse()
    @ApiBadRequestResponse()
    @ApiUnauthorizedResponse()
    async addScenario(@Body() createScenarioDto: CreateScenarioDto): Promise<Scenario> {
        return this.scenariosService.addScenario(createScenarioDto);
    }

    @Put('/:externalId')
    @ApiParam({ name: 'externalId', description: 'External ID of the scenario to update', example: 'f3cec07c-9834-4a02-990d-28b0d99534ab' })
    @ApiOperation({ summary: 'Update an existing scenario by the provided external ID' })
    @ApiOkResponse()
    @ApiNotFoundResponse()
    @ApiBadRequestResponse()
    @ApiUnauthorizedResponse()
    async updateScenario(@Param('externalId') externalId: string, @Body() updateScenarioDto: UpdateScenarioDto): Promise<Scenario> {
        return this.scenariosService.updateScenario(externalId, updateScenarioDto);
    }

    @Delete('/:externalId')
    @ApiParam({ name: 'externalId', description: 'External ID of the scenario to delete', example: 'f3cec07c-9834-4a02-990d-28b0d99534ab' })
    @ApiOperation({ summary: 'Delete an existing scenario by the provided external ID' })
    @ApiOkResponse()
    @ApiNotFoundResponse()
    @ApiBadRequestResponse()
    @ApiUnauthorizedResponse()
    async removeScenario(@Param('externalId') externalId: string): Promise<Scenario> {
        return this.scenariosService.removeScenario(externalId);
    }
}
