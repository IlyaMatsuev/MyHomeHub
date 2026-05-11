import { Test, TestingModule } from '@nestjs/testing';
import { ScenariosController } from './scenarios.controller';
import { ScenariosService } from './scenarios.service';
import { ScenarioGroupsService } from './scenario-groups.service';
import { Scenario, ScenarioCronTriggerSource, ScenarioGroup, ScenarioTriggerSourceType } from './interfaces';
import { CreateScenarioDto, DeleteScenarioGroupDto, GetScenarioGroupsDto, GetScenariosDto, UpdateScenarioDto } from './dto';

describe('ScenariosController', () => {
    let controller: ScenariosController;
    let mockScenariosService: {
        getScenarios: jest.Mock;
        getScenarioByExternalId: jest.Mock;
        addScenario: jest.Mock;
        updateScenario: jest.Mock;
        removeScenario: jest.Mock;
    };
    let mockScenarioGroupsService: {
        getGroups: jest.Mock;
        deleteGroup: jest.Mock;
    };

    const mockScenario: Partial<Scenario> = {
        _id: 'mongo-id-123',
        externalId: 'scenario-uuid-123',
        name: 'Test Scenario',
        description: 'Test description',
        active: true,
        trigger: {
            sources: [{ type: ScenarioTriggerSourceType.Cron, cron: '0 8 * * *' } as ScenarioCronTriggerSource],
            logic: '1',
        },
        devices: [],
    };

    const mockGroup: Partial<ScenarioGroup> = {
        _id: 'mongo-id-456',
        id: 1,
        name: 'test_group',
        scenariosCount: 2,
    };

    beforeEach(async () => {
        mockScenariosService = {
            getScenarios: jest.fn(),
            getScenarioByExternalId: jest.fn(),
            addScenario: jest.fn(),
            updateScenario: jest.fn(),
            removeScenario: jest.fn(),
        };
        mockScenarioGroupsService = {
            getGroups: jest.fn(),
            deleteGroup: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [ScenariosController],
            providers: [
                {
                    provide: ScenariosService,
                    useValue: mockScenariosService,
                },
                {
                    provide: ScenarioGroupsService,
                    useValue: mockScenarioGroupsService,
                },
            ],
        }).compile();

        controller = module.get<ScenariosController>(ScenariosController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getScenarios', () => {
        it('should return paginated scenarios', async () => {
            const scenariosPage = {
                scenarios: [mockScenario],
                page: 1,
                pageSize: 10,
                totalPages: 1,
            };
            mockScenariosService.getScenarios.mockResolvedValue(scenariosPage);

            const query = new GetScenariosDto();
            const result = await controller.getScenarios(query);

            expect(result).toEqual(scenariosPage);
            expect(mockScenariosService.getScenarios).toHaveBeenCalledWith(query);
        });
    });

    describe('getScenario', () => {
        it('should return scenario by external ID', async () => {
            mockScenariosService.getScenarioByExternalId.mockResolvedValue(mockScenario);

            const result = await controller.getScenario('scenario-uuid-123');

            expect(result).toEqual(mockScenario);
            expect(mockScenariosService.getScenarioByExternalId).toHaveBeenCalledWith('scenario-uuid-123');
        });
    });

    describe('addScenario', () => {
        it('should create and return new scenario', async () => {
            mockScenariosService.addScenario.mockResolvedValue(mockScenario);

            const createDto = {
                name: 'Test Scenario',
                trigger: {
                    sources: [{ type: ScenarioTriggerSourceType.Cron, cron: '0 8 * * *' } as ScenarioCronTriggerSource],
                    logic: '1',
                },
                devices: [],
            } as unknown as CreateScenarioDto;

            const result = await controller.addScenario(createDto);

            expect(result).toEqual(mockScenario);
            expect(mockScenariosService.addScenario).toHaveBeenCalledWith(createDto);
        });
    });

    describe('updateScenario', () => {
        it('should update and return scenario', async () => {
            const updatedScenario = { ...mockScenario, name: 'Updated Scenario' };
            mockScenariosService.updateScenario.mockResolvedValue(updatedScenario);

            const updateDto: UpdateScenarioDto = { name: 'Updated Scenario' };
            const result = await controller.updateScenario('scenario-uuid-123', updateDto);

            expect(result).toEqual(updatedScenario);
            expect(mockScenariosService.updateScenario).toHaveBeenCalledWith('scenario-uuid-123', updateDto);
        });
    });

    describe('removeScenario', () => {
        it('should delete and return scenario', async () => {
            mockScenariosService.removeScenario.mockResolvedValue(mockScenario);

            const result = await controller.removeScenario('scenario-uuid-123');

            expect(result).toEqual(mockScenario);
            expect(mockScenariosService.removeScenario).toHaveBeenCalledWith('scenario-uuid-123');
        });
    });

    describe('getGroups', () => {
        it('should return all groups', async () => {
            const groups = [mockGroup];
            mockScenarioGroupsService.getGroups.mockResolvedValue(groups);

            const query = new GetScenarioGroupsDto();
            const result = await controller.getGroups(query);

            expect(result).toEqual(groups);
            expect(mockScenarioGroupsService.getGroups).toHaveBeenCalledWith(query);
        });

        it('should filter groups by term', async () => {
            const groups = [mockGroup];
            mockScenarioGroupsService.getGroups.mockResolvedValue(groups);

            const query = new GetScenarioGroupsDto();
            query.term = 'test';
            const result = await controller.getGroups(query);

            expect(result).toEqual(groups);
            expect(mockScenarioGroupsService.getGroups).toHaveBeenCalledWith(query);
        });
    });

    describe('deleteGroup', () => {
        it('should delete group by id', async () => {
            mockScenarioGroupsService.deleteGroup.mockResolvedValue(mockGroup);

            const query = new DeleteScenarioGroupDto();
            const result = await controller.deleteGroup('1', query);

            expect(result).toEqual(mockGroup);
            expect(mockScenarioGroupsService.deleteGroup).toHaveBeenCalledWith('1', undefined);
        });

        it('should delete group by name with deleteScenarios=true', async () => {
            mockScenarioGroupsService.deleteGroup.mockResolvedValue(mockGroup);

            const query = new DeleteScenarioGroupDto();
            query.deleteScenarios = true;
            const result = await controller.deleteGroup('test_group', query);

            expect(result).toEqual(mockGroup);
            expect(mockScenarioGroupsService.deleteGroup).toHaveBeenCalledWith('test_group', true);
        });

        it('should delete group with deleteScenarios=false', async () => {
            mockScenarioGroupsService.deleteGroup.mockResolvedValue(mockGroup);

            const query = new DeleteScenarioGroupDto();
            query.deleteScenarios = false;
            const result = await controller.deleteGroup('test_group', query);

            expect(result).toEqual(mockGroup);
            expect(mockScenarioGroupsService.deleteGroup).toHaveBeenCalledWith('test_group', false);
        });
    });
});
