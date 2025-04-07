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
import { Scenario, ScenariosPage } from 'scenarios/interfaces';
import { CreateScenarioDto, GetScenariosDto, UpdateScenarioDto } from 'scenarios/dto';

@ApiBearerAuth()
@Controller('scenarios')
export class ScenariosController {
    constructor(private readonly scenariosService: ScenariosService) {}

    @Get()
    @ApiOperation({ summary: 'Get all added scenarios' })
    @ApiOkResponse()
    @ApiUnauthorizedResponse()
    async getScenarios(@Query() query: GetScenariosDto): Promise<ScenariosPage> {
        return this.scenariosService.getScenarios(query);
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
