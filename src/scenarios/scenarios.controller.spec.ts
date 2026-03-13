import { Test, TestingModule } from '@nestjs/testing';
import { ScenariosController } from './scenarios.controller';
import { ScenariosService } from './scenarios.service';
import { Scenario, ScenarioCronTriggerSource, ScenarioTriggerSourceType } from './interfaces';
import { CreateScenarioDto, GetScenariosDto, UpdateScenarioDto } from './dto';

describe('ScenariosController', () => {
    let controller: ScenariosController;
    let mockScenariosService: {
        getScenarios: jest.Mock;
        getScenarioByExternalId: jest.Mock;
        addScenario: jest.Mock;
        updateScenario: jest.Mock;
        removeScenario: jest.Mock;
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

    beforeEach(async () => {
        mockScenariosService = {
            getScenarios: jest.fn(),
            getScenarioByExternalId: jest.fn(),
            addScenario: jest.fn(),
            updateScenario: jest.fn(),
            removeScenario: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [ScenariosController],
            providers: [
                {
                    provide: ScenariosService,
                    useValue: mockScenariosService,
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
});
