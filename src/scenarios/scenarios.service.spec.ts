import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ScenariosService } from './scenarios.service';
import { ScenarioGroupsService } from './scenario-groups.service';
import { SCENARIO_MODEL_PROVIDER_NAME } from './scenarios.constants';
import { SchedulerService } from 'scheduler/scheduler.service';
import { ScenariosExecutionService } from './scenarios-execution.service';
import { DevicesService } from 'devices/devices.service';
import { Scenario, ScenarioCronTriggerSource, ScenarioTriggerSourceType } from './interfaces';
import { CreateScenarioDto, GetScenariosDto, UpdateScenarioDto } from './dto';
import { Room } from 'devices/interfaces';

describe('ScenariosService', () => {
    let service: ScenariosService;
    let mockScenarioModel: {
        find: jest.Mock;
        findOne: jest.Mock;
        findByIdAndUpdate: jest.Mock;
        countDocuments: jest.Mock;
        deleteOne: jest.Mock;
        new: jest.Mock;
    };
    let mockSchedulerService: {
        scheduleJob: jest.Mock;
        unscheduleJob: jest.Mock;
        adjustScenarioDayTimeCron: jest.Mock;
    };
    let mockScenariosExecutionService: { execute: jest.Mock };
    let mockScenarioGroupsService: {
        syncGroupOnCreate: jest.Mock;
        syncGroupOnUpdate: jest.Mock;
        syncGroupOnDelete: jest.Mock;
    };
    let mockDevicesService: { getAllDevices: jest.Mock };

    const mockScenario: Partial<Scenario> = {
        _id: 'mongo-id-123',
        externalId: 'scenario-uuid-123',
        name: 'Test Scenario',
        description: 'Test description',
        active: true,
        repeatTimes: null,
        trigger: {
            sources: [{ type: ScenarioTriggerSourceType.Cron, cron: '0 8 * * *' } as ScenarioCronTriggerSource],
            logic: '1',
        },
        devices: [{ externalId: 'device-1', set: { controls: { on: true } as unknown as Record<string, object> } }],
        toObject: jest.fn().mockReturnValue({
            name: 'Test Scenario',
            active: true,
            trigger: {
                sources: [{ type: ScenarioTriggerSourceType.Cron, cron: '0 8 * * *' }],
                logic: '1',
            },
            devices: [],
        }),
        save: jest.fn(),
    };

    beforeEach(async () => {
        const MockScenarioModel = jest.fn().mockImplementation(function (data) {
            return {
                ...mockScenario,
                ...data,
                save: jest.fn().mockResolvedValue({ ...mockScenario, ...data }),
            };
        }) as jest.Mock & {
            find: jest.Mock;
            findOne: jest.Mock;
            findByIdAndUpdate: jest.Mock;
            countDocuments: jest.Mock;
            deleteOne: jest.Mock;
        };
        MockScenarioModel.find = jest.fn();
        MockScenarioModel.findOne = jest.fn();
        MockScenarioModel.findByIdAndUpdate = jest.fn();
        MockScenarioModel.countDocuments = jest.fn();
        MockScenarioModel.deleteOne = jest.fn();

        mockScenarioModel = MockScenarioModel as unknown as typeof mockScenarioModel;
        mockSchedulerService = {
            scheduleJob: jest.fn(),
            unscheduleJob: jest.fn(),
            adjustScenarioDayTimeCron: jest.fn().mockReturnValue('0 6 * * *'),
        };
        mockScenariosExecutionService = { execute: jest.fn() };
        mockScenarioGroupsService = {
            syncGroupOnCreate: jest.fn().mockResolvedValue(undefined),
            syncGroupOnUpdate: jest.fn().mockResolvedValue(undefined),
            syncGroupOnDelete: jest.fn().mockResolvedValue(undefined),
        };
        mockDevicesService = {
            getAllDevices: jest.fn().mockResolvedValue({ items: [], page: 1, pageSize: 0, totalPages: 0, totalItems: 0 }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ScenariosService,
                {
                    provide: SCENARIO_MODEL_PROVIDER_NAME,
                    useValue: mockScenarioModel,
                },
                {
                    provide: SchedulerService,
                    useValue: mockSchedulerService,
                },
                {
                    provide: ScenariosExecutionService,
                    useValue: mockScenariosExecutionService,
                },
                {
                    provide: ScenarioGroupsService,
                    useValue: mockScenarioGroupsService,
                },
                {
                    provide: DevicesService,
                    useValue: mockDevicesService,
                },
            ],
        }).compile();

        service = module.get<ScenariosService>(ScenariosService);
        mockScenarioModel.find.mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
        });
        await service.onModuleInit();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('onModuleInit', () => {
        it('should schedule existing active scenarios', async () => {
            mockScenarioModel.find.mockReturnValue({
                exec: jest.fn().mockResolvedValue([mockScenario]),
            });

            await service.onModuleInit();

            expect(mockScenarioModel.find).toHaveBeenCalledWith({ active: true });
            expect(mockSchedulerService.scheduleJob).toHaveBeenCalled();
        });
    });

    describe('scheduled job handler', () => {
        it('should re-fetch the latest scenario state and execute it when the cron fires', async () => {
            mockScenarioModel.find.mockReturnValue({
                exec: jest.fn().mockResolvedValue([mockScenario]),
            });

            await service.onModuleInit();

            const { handler } = mockSchedulerService.scheduleJob.mock.calls[0][0];

            // The fresh state the handler should pick up at fire time (not the stale closure scenario).
            const freshScenario = { ...mockScenario, active: false };
            mockScenarioModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(freshScenario),
            });

            await handler();

            expect(mockScenarioModel.findOne).toHaveBeenCalledWith({ externalId: mockScenario.externalId });
            expect(mockScenariosExecutionService.execute).toHaveBeenCalledWith(freshScenario, { scheduled: true });
        });
    });

    describe('getScenarios', () => {
        it('should return paginated active scenarios by default', async () => {
            const scenarios = [mockScenario];
            mockScenarioModel.find.mockReturnValue({
                skip: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue(scenarios),
                    }),
                }),
            });
            mockScenarioModel.countDocuments.mockResolvedValue(1);

            const options = new GetScenariosDto();
            options.page = 1;
            options.pageSize = 10;

            const result = await service.getScenarios(options);

            expect(result.items).toEqual(scenarios);
            expect(result.page).toBe(1);
            expect(mockScenarioModel.find).toHaveBeenCalledWith({ active: true });
        });

        it('should include inactive scenarios when requested', async () => {
            mockScenarioModel.find.mockReturnValue({
                skip: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });
            mockScenarioModel.countDocuments.mockResolvedValue(0);

            const options = new GetScenariosDto();
            options.includeInactive = true;

            await service.getScenarios(options);

            expect(mockScenarioModel.find).toHaveBeenCalledWith({});
        });

        it('should filter scenarios by group when provided', async () => {
            mockScenarioModel.find.mockReturnValue({
                skip: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });
            mockScenarioModel.countDocuments.mockResolvedValue(0);

            const options = new GetScenariosDto();
            options.group = 'test_group';

            await service.getScenarios(options);

            expect(mockScenarioModel.find).toHaveBeenCalledWith({ active: true, group: 'test_group' });
        });

        it('should filter scenarios by room when provided', async () => {
            mockScenarioModel.find.mockReturnValue({
                skip: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });
            mockScenarioModel.countDocuments.mockResolvedValue(0);
            mockDevicesService.getAllDevices.mockResolvedValue({
                items: [{ externalId: 'device-1' }, { externalId: 'device-2' }],
                page: 1,
                pageSize: 2,
                totalPages: 1,
                totalItems: 2,
            });

            const options = new GetScenariosDto();
            options.room = Room.LivingRoom;

            await service.getScenarios(options);

            expect(mockDevicesService.getAllDevices).toHaveBeenCalledWith({ room: Room.LivingRoom });
            expect(mockScenarioModel.find).toHaveBeenCalledWith({
                active: true,
                'devices.externalId': { $in: ['device-1', 'device-2'] },
            });
        });

        it('should filter scenarios by room none when provided', async () => {
            mockScenarioModel.find.mockReturnValue({
                skip: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });
            mockScenarioModel.countDocuments.mockResolvedValue(0);
            mockDevicesService.getAllDevices.mockResolvedValue({
                items: [{ externalId: 'device-no-room' }],
                page: 1,
                pageSize: 1,
                totalPages: 1,
                totalItems: 1,
            });

            const options = new GetScenariosDto();
            options.room = Room.None;

            await service.getScenarios(options);

            expect(mockDevicesService.getAllDevices).toHaveBeenCalledWith({ room: Room.None });
            expect(mockScenarioModel.find).toHaveBeenCalledWith({
                active: true,
                'devices.externalId': { $in: ['device-no-room'] },
            });
        });
    });

    describe('getScenariosWithAdjustableTime', () => {
        it('should return scenarios with adjustable time triggers', async () => {
            const scenarios = [mockScenario];
            mockScenarioModel.find.mockReturnValue({
                exec: jest.fn().mockResolvedValue(scenarios),
            });

            const result = await service.getScenariosWithAdjustableTime();

            expect(result).toEqual(scenarios);
            expect(mockScenarioModel.find).toHaveBeenCalledWith({
                'trigger.sources': {
                    $elemMatch: {
                        type: ScenarioTriggerSourceType.Cron,
                        adjustTo: { $exists: true },
                    },
                },
            });
        });
    });

    describe('getDeviceTriggeredScenarios', () => {
        it('should return active scenarios triggered by device', async () => {
            const scenarios = [mockScenario];
            mockScenarioModel.find.mockReturnValue({
                exec: jest.fn().mockResolvedValue(scenarios),
            });

            const result = await service.getDeviceTriggeredScenarios('device-1');

            expect(result).toEqual(scenarios);
            expect(mockScenarioModel.find).toHaveBeenCalledWith({
                active: true,
                'trigger.sources': {
                    $elemMatch: {
                        type: 'device',
                        'device.externalId': 'device-1',
                    },
                },
            });
        });
    });

    describe('getScenarioByExternalId', () => {
        it('should return scenario when found', async () => {
            mockScenarioModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockScenario),
            });

            const result = await service.getScenarioByExternalId('scenario-uuid-123');

            expect(result).toEqual(mockScenario);
            expect(mockScenarioModel.findOne).toHaveBeenCalledWith({ externalId: 'scenario-uuid-123' });
        });

        it('should throw NotFoundException when scenario not found', async () => {
            mockScenarioModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            await expect(service.getScenarioByExternalId('nonexistent')).rejects.toThrow(NotFoundException);
        });

        it('should return null with non-strict mode', async () => {
            mockScenarioModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            const result = await service.getScenarioByExternalId('nonexistent', { strict: false });

            expect(result).toBeNull();
        });
    });

    describe('addScenario', () => {
        it('should create scenario and schedule if active with cron trigger', async () => {
            mockScenarioModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            const createDto: CreateScenarioDto = {
                name: 'New Scenario',
                trigger: {
                    sources: [{ type: ScenarioTriggerSourceType.Cron, cron: '0 9 * * *' }],
                    logic: '1',
                },
                devices: [],
            } as unknown as CreateScenarioDto;

            const result = await service.addScenario(createDto);

            expect(result.name).toBe('New Scenario');
            expect(mockSchedulerService.scheduleJob).toHaveBeenCalled();
        });

        it('should sync group on create when group is provided', async () => {
            mockScenarioModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            const createDto: CreateScenarioDto = {
                name: 'Grouped Scenario',
                group: 'test_group',
                trigger: {
                    sources: [{ type: ScenarioTriggerSourceType.Cron, cron: '0 9 * * *' }],
                    logic: '1',
                },
                devices: [],
            } as unknown as CreateScenarioDto;

            await service.addScenario(createDto);

            expect(mockScenarioGroupsService.syncGroupOnCreate).toHaveBeenCalledWith('test_group');
        });

        it('should throw BadRequestException when scenario with same name exists', async () => {
            mockScenarioModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockScenario),
            });

            const createDto: CreateScenarioDto = {
                name: 'Test Scenario',
                trigger: { sources: [], logic: '1' },
                devices: [],
            } as unknown as CreateScenarioDto;

            await expect(service.addScenario(createDto)).rejects.toThrow(BadRequestException);
        });

        it('should adjust cron time when adjustTo is specified', async () => {
            mockScenarioModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            const createDto: CreateScenarioDto = {
                name: 'Sunrise Scenario',
                trigger: {
                    sources: [{ type: ScenarioTriggerSourceType.Cron, cron: '0 0 * * *', adjustTo: 'sunrise' }],
                    logic: '1',
                },
                devices: [],
            } as unknown as CreateScenarioDto;

            await service.addScenario(createDto);

            expect(mockSchedulerService.adjustScenarioDayTimeCron).toHaveBeenCalled();
        });

        it('should throw InternalServerErrorException when scheduling fails', async () => {
            // First call returns null (no existing scenario with same name)
            // Second call returns the scenario (for the onFailure removal)
            mockScenarioModel.findOne
                .mockReturnValueOnce({
                    exec: jest.fn().mockResolvedValue(null),
                })
                .mockReturnValueOnce({
                    exec: jest.fn().mockResolvedValue(mockScenario),
                });
            mockScenarioModel.deleteOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
            });
            mockSchedulerService.scheduleJob.mockImplementation(() => {
                throw new Error('Scheduling failed');
            });

            const createDto: CreateScenarioDto = {
                name: 'Failing Scenario',
                trigger: {
                    sources: [{ type: ScenarioTriggerSourceType.Cron, cron: 'invalid-cron' }],
                    logic: '1',
                },
                devices: [],
            } as unknown as CreateScenarioDto;

            await expect(service.addScenario(createDto)).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('updateScenario', () => {
        it('should update scenario fields', async () => {
            const scenarioWithSave = {
                ...mockScenario,
                save: jest.fn().mockResolvedValue(mockScenario),
            };
            mockScenarioModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(scenarioWithSave),
            });

            const updateDto: UpdateScenarioDto = { name: 'Updated Name' };

            await service.updateScenario('scenario-uuid-123', updateDto);

            expect(scenarioWithSave.save).toHaveBeenCalled();
        });

        it('should sync group on update when group changes', async () => {
            const scenarioWithGroup = {
                ...mockScenario,
                group: 'old_group',
                toObject: jest.fn().mockReturnValue({
                    name: 'Test Scenario',
                    active: true,
                    group: 'old_group',
                    trigger: {
                        sources: [{ type: ScenarioTriggerSourceType.Cron, cron: '0 8 * * *' }],
                        logic: '1',
                    },
                    devices: [],
                }),
                save: jest.fn().mockResolvedValue({ ...mockScenario, group: 'new_group' }),
            };
            mockScenarioModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(scenarioWithGroup),
            });

            const updateDto: UpdateScenarioDto = { group: 'new_group' };

            await service.updateScenario('scenario-uuid-123', updateDto);

            expect(mockScenarioGroupsService.syncGroupOnUpdate).toHaveBeenCalledWith('old_group', 'new_group');
        });

        it('should reschedule cron scenario when updated', async () => {
            const scenarioWithSave = {
                ...mockScenario,
                save: jest.fn().mockResolvedValue(mockScenario),
            };
            mockScenarioModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(scenarioWithSave),
            });
            mockScenarioModel.findByIdAndUpdate.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockScenario),
            });

            const updateDto: UpdateScenarioDto = {
                trigger: {
                    sources: [{ type: ScenarioTriggerSourceType.Cron, cron: '0 10 * * *' } as ScenarioCronTriggerSource],
                    logic: '1',
                },
            };

            await service.updateScenario('scenario-uuid-123', updateDto);

            expect(mockSchedulerService.unscheduleJob).toHaveBeenCalledWith('Test Scenario');
            expect(mockSchedulerService.scheduleJob).toHaveBeenCalled();
        });

        it('should throw NotFoundException when scenario not found', async () => {
            mockScenarioModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            await expect(service.updateScenario('nonexistent', { name: 'Updated' })).rejects.toThrow(NotFoundException);
        });
    });

    describe('removeScenario', () => {
        it('should delete scenario and unschedule if active', async () => {
            mockScenarioModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockScenario),
            });
            mockScenarioModel.deleteOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
            });

            const result = await service.removeScenario('scenario-uuid-123');

            expect(result).toEqual(mockScenario);
            expect(mockSchedulerService.unscheduleJob).toHaveBeenCalledWith('Test Scenario');
            expect(mockScenarioModel.deleteOne).toHaveBeenCalledWith({ _id: mockScenario._id });
        });

        it('should sync group on delete when scenario has a group', async () => {
            const scenarioWithGroup = { ...mockScenario, group: 'test_group' };
            mockScenarioModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(scenarioWithGroup),
            });
            mockScenarioModel.deleteOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
            });

            await service.removeScenario('scenario-uuid-123');

            expect(mockScenarioGroupsService.syncGroupOnDelete).toHaveBeenCalledWith('test_group');
        });

        it('should not unschedule inactive scenarios', async () => {
            const inactiveScenario = { ...mockScenario, active: false };
            mockScenarioModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(inactiveScenario),
            });
            mockScenarioModel.deleteOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
            });

            await service.removeScenario('scenario-uuid-123');

            expect(mockSchedulerService.unscheduleJob).not.toHaveBeenCalled();
        });
    });
});
