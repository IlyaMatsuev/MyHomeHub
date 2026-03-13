import { Test, TestingModule } from '@nestjs/testing';
import { ScenariosExecutionService } from './scenarios-execution.service';
import { ScenariosService } from './scenarios.service';
import { DevicesService } from 'devices/devices.service';
import { ConditionsEvaluatorService } from 'common/services/conditions-evaluator.service';
import { Scenario, ScenarioCronTriggerSource, ScenarioTriggerSourceType } from './interfaces';
import { Device, DeviceBrand, DeviceType, Room } from 'devices/interfaces';
import { DeviceControlsUpdatedEvent, DeviceMeasurementsUpdatedEvent } from 'devices/events';

describe('ScenariosExecutionService', () => {
    let service: ScenariosExecutionService;
    let mockScenariosService: {
        getScenarioByExternalId: jest.Mock;
        getDeviceTriggeredScenarios: jest.Mock;
        updateScenario: jest.Mock;
    };
    let mockDevicesService: {
        getDeviceByExternalId: jest.Mock;
        updateDevice: jest.Mock;
        getControlService: jest.Mock;
    };
    let mockConditionsEvaluatorService: {
        evaluateTriggerExpression: jest.Mock;
        deviceConditionIsMet: jest.Mock;
    };

    const mockDevice: Partial<Device> = {
        _id: 'device-mongo-id',
        externalId: 'device-1',
        name: 'Test Device',
        type: DeviceType.LED,
        brand: DeviceBrand.Tuya,
        room: Room.LivingRoom,
        controls: { on: false },
        measurements: {},
    };

    const mockScenario: Partial<Scenario> = {
        _id: 'scenario-mongo-id',
        externalId: 'scenario-1',
        name: 'Test Scenario',
        active: true,
        repeatTimes: null,
        trigger: {
            sources: [{ type: ScenarioTriggerSourceType.Cron, cron: '0 8 * * *' } as ScenarioCronTriggerSource],
            logic: '1',
        },
        devices: [{ externalId: 'device-1', set: { controls: { on: true } as unknown as Record<string, object> } }],
    };

    const mockControlService = {
        setControls: jest.fn(),
    };

    beforeEach(async () => {
        mockScenariosService = {
            getScenarioByExternalId: jest.fn(),
            getDeviceTriggeredScenarios: jest.fn(),
            updateScenario: jest.fn(),
        };
        mockDevicesService = {
            getDeviceByExternalId: jest.fn(),
            updateDevice: jest.fn(),
            getControlService: jest.fn().mockReturnValue(mockControlService),
        };
        mockConditionsEvaluatorService = {
            evaluateTriggerExpression: jest.fn(),
            deviceConditionIsMet: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ScenariosExecutionService,
                {
                    provide: ScenariosService,
                    useValue: mockScenariosService,
                },
                {
                    provide: DevicesService,
                    useValue: mockDevicesService,
                },
                {
                    provide: ConditionsEvaluatorService,
                    useValue: mockConditionsEvaluatorService,
                },
            ],
        }).compile();

        service = module.get<ScenariosExecutionService>(ScenariosExecutionService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('execute', () => {
        it('should execute scenario when conditions are met', async () => {
            mockScenariosService.getScenarioByExternalId.mockResolvedValue(mockScenario);
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(true);
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(mockDevice);
            mockDevicesService.updateDevice.mockResolvedValue(mockDevice);

            await service.execute('scenario-1', true);

            expect(mockScenariosService.getScenarioByExternalId).toHaveBeenCalledWith('scenario-1');
            expect(mockConditionsEvaluatorService.evaluateTriggerExpression).toHaveBeenCalledWith('1', [true]);
            expect(mockDevicesService.updateDevice).toHaveBeenCalled();
        });

        it('should not execute scenario when conditions are not met', async () => {
            mockScenariosService.getScenarioByExternalId.mockResolvedValue(mockScenario);
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(false);

            await service.execute('scenario-1', true);

            expect(mockDevicesService.updateDevice).not.toHaveBeenCalled();
        });

        it('should handle device trigger sources', async () => {
            const scenarioWithDeviceTrigger = {
                ...mockScenario,
                trigger: {
                    sources: [
                        {
                            type: ScenarioTriggerSourceType.Device,
                            device: { externalId: 'device-1', controls: { are: { on: true } } },
                        },
                    ],
                    logic: '1',
                },
            };
            mockScenariosService.getScenarioByExternalId.mockResolvedValue(scenarioWithDeviceTrigger);
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(mockDevice);
            mockConditionsEvaluatorService.deviceConditionIsMet.mockReturnValue(true);
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(true);
            mockDevicesService.updateDevice.mockResolvedValue(mockDevice);

            await service.execute('scenario-1', false);

            expect(mockConditionsEvaluatorService.deviceConditionIsMet).toHaveBeenCalled();
        });

        it('should decrement repeatTimes when scenario has limited executions', async () => {
            const scenarioWithRepeatTimes = {
                ...mockScenario,
                repeatTimes: 3,
            };
            mockScenariosService.getScenarioByExternalId.mockResolvedValue(scenarioWithRepeatTimes);
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(true);
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(mockDevice);
            mockDevicesService.updateDevice.mockResolvedValue(mockDevice);
            mockScenariosService.updateScenario.mockResolvedValue(scenarioWithRepeatTimes);

            await service.execute('scenario-1', true);

            expect(mockScenariosService.updateScenario).toHaveBeenCalledWith('scenario-1', { repeatTimes: 2 });
        });

        it('should deactivate scenario when repeatTimes reaches 0', async () => {
            const scenarioWithLastExecution = {
                ...mockScenario,
                repeatTimes: 1,
            };
            mockScenariosService.getScenarioByExternalId.mockResolvedValue(scenarioWithLastExecution);
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(true);
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(mockDevice);
            mockDevicesService.updateDevice.mockResolvedValue(mockDevice);
            mockScenariosService.updateScenario.mockResolvedValue(scenarioWithLastExecution);

            await service.execute('scenario-1', true);

            expect(mockScenariosService.updateScenario).toHaveBeenCalledWith('scenario-1', {
                active: false,
                repeatTimes: null,
            });
        });

        it('should handle errors gracefully', async () => {
            mockScenariosService.getScenarioByExternalId.mockRejectedValue(new Error('Database error'));

            await expect(service.execute('scenario-1', true)).resolves.not.toThrow();
        });

        it('should execute multiple device actions', async () => {
            const scenarioWithMultipleDevices = {
                ...mockScenario,
                devices: [
                    { externalId: 'device-1', set: { controls: { on: true } } },
                    { externalId: 'device-2', set: { controls: { brightness: 50 } } },
                ],
            };
            mockScenariosService.getScenarioByExternalId.mockResolvedValue(scenarioWithMultipleDevices);
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(true);
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(mockDevice);
            mockDevicesService.updateDevice.mockResolvedValue(mockDevice);

            await service.execute('scenario-1', true);

            expect(mockDevicesService.updateDevice).toHaveBeenCalledTimes(2);
        });

        it('should skip device actions without controls', async () => {
            const scenarioWithoutControls = {
                ...mockScenario,
                devices: [{ externalId: 'device-1', set: {} }],
            };
            mockScenariosService.getScenarioByExternalId.mockResolvedValue(scenarioWithoutControls);
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(true);

            await service.execute('scenario-1', true);

            expect(mockDevicesService.updateDevice).not.toHaveBeenCalled();
        });
    });

    describe('event handlers', () => {
        it('should trigger related scenarios on device controls update', async () => {
            const event = new DeviceControlsUpdatedEvent('device-1', { on: true });
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(mockDevice);
            mockScenariosService.getDeviceTriggeredScenarios.mockResolvedValue([mockScenario]);
            mockScenariosService.getScenarioByExternalId.mockResolvedValue(mockScenario);
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(false);

            await service['onDeviceControlsUpdated'](event);

            expect(mockDevicesService.getControlService).toHaveBeenCalledWith(mockDevice);
            expect(mockControlService.setControls).toHaveBeenCalledWith({ on: true });
            expect(mockScenariosService.getDeviceTriggeredScenarios).toHaveBeenCalledWith('device-1');
        });

        it('should trigger related scenarios on device measurements update', async () => {
            const event = new DeviceMeasurementsUpdatedEvent('device-1');
            mockScenariosService.getDeviceTriggeredScenarios.mockResolvedValue([mockScenario]);
            mockScenariosService.getScenarioByExternalId.mockResolvedValue(mockScenario);
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(false);

            await service['onDeviceMeasurementsUpdated'](event);

            expect(mockScenariosService.getDeviceTriggeredScenarios).toHaveBeenCalledWith('device-1');
        });
    });
});
