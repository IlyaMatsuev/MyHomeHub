import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ScenariosExecutionService } from './scenarios-execution.service';
import { ScenariosService } from './scenarios.service';
import { DevicesService } from 'devices/devices.service';
import { ConditionsEvaluatorService } from 'common/services';
import { Scenario, ScenarioCronTriggerSource, ScenarioTriggerSourceType } from './interfaces';
import { Device, DeviceBrand, DeviceType, Room } from 'devices/interfaces';
import { DeviceCommandExecutedEvent, DeviceUpdateCompletedEvent, DeviceUpdateRequestedEvent } from 'devices/events';
import { UpdateDeviceDto } from 'devices/dto';

describe('ScenariosExecutionService', () => {
    let service: ScenariosExecutionService;
    let mockScenariosService: {
        getScenarioByExternalId: jest.Mock;
        getDeviceTriggeredScenarios: jest.Mock;
        updateScenario: jest.Mock;
    };
    let mockDevicesService: {
        getDeviceByExternalId: jest.Mock;
    };
    let mockConditionsEvaluatorService: {
        evaluateTriggerExpression: jest.Mock;
        deviceConditionIsMet: jest.Mock;
    };
    let mockEventEmitter: { emit: jest.Mock };

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

    // The update requests emitted for device actions, in emission order.
    const emittedDeviceUpdates = (): Array<DeviceUpdateRequestedEvent> => {
        return mockEventEmitter.emit.mock.calls
            .filter(([eventName]) => eventName === DeviceUpdateRequestedEvent.eventName)
            .map(([, event]) => event as DeviceUpdateRequestedEvent);
    };

    beforeEach(async () => {
        mockScenariosService = {
            getScenarioByExternalId: jest.fn(),
            getDeviceTriggeredScenarios: jest.fn(),
            updateScenario: jest.fn(),
        };
        mockDevicesService = {
            getDeviceByExternalId: jest.fn(),
        };
        mockConditionsEvaluatorService = {
            evaluateTriggerExpression: jest.fn(),
            deviceConditionIsMet: jest.fn(),
        };
        mockEventEmitter = { emit: jest.fn() };

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
                {
                    provide: EventEmitter2,
                    useValue: mockEventEmitter,
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
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(true);

            await service.execute(mockScenario as Scenario, { scheduled: true });

            expect(mockConditionsEvaluatorService.evaluateTriggerExpression).toHaveBeenCalledWith('1', [true]);
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                DeviceUpdateRequestedEvent.eventName,
                expect.objectContaining({
                    selector: { externalId: 'device-1' },
                    update: expect.objectContaining({ controls: { on: true } }),
                }),
            );
        });

        it('should emit a device update request instead of loading and updating the device itself', async () => {
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(true);

            await service.execute(mockScenario as Scenario, { scheduled: true });

            // The device action is resolved by DevicesService through the event, so the scenario
            // execution never has to look the device up by its external id.
            expect(mockDevicesService.getDeviceByExternalId).not.toHaveBeenCalled();
            const [event] = emittedDeviceUpdates();
            expect(event).toBeInstanceOf(DeviceUpdateRequestedEvent);
            expect(event.update).toBeInstanceOf(UpdateDeviceDto);
            expect(event.update.controls).toEqual({ on: true });
        });

        it('should use the scenario passed in without re-fetching it', async () => {
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(false);

            await service.execute(mockScenario as Scenario, { scheduled: true });

            expect(mockScenariosService.getScenarioByExternalId).not.toHaveBeenCalled();
        });

        it('should not execute scenario when conditions are not met', async () => {
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(false);

            await service.execute(mockScenario as Scenario, { scheduled: true });

            expect(mockEventEmitter.emit).not.toHaveBeenCalled();
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
            } as unknown as Scenario;
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(mockDevice);
            mockConditionsEvaluatorService.deviceConditionIsMet.mockReturnValue(true);
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(true);

            await service.execute(scenarioWithDeviceTrigger, {});

            expect(mockConditionsEvaluatorService.deviceConditionIsMet).toHaveBeenCalled();
        });

        it('should decrement repeatTimes when scenario has limited executions', async () => {
            const scenarioWithRepeatTimes = {
                ...mockScenario,
                repeatTimes: 3,
            } as Scenario;
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(true);
            mockScenariosService.updateScenario.mockResolvedValue(scenarioWithRepeatTimes);

            await service.execute(scenarioWithRepeatTimes, { scheduled: true });

            expect(mockScenariosService.updateScenario).toHaveBeenCalledWith('scenario-1', { repeatTimes: 2 });
        });

        it('should deactivate scenario when repeatTimes reaches 0', async () => {
            const scenarioWithLastExecution = {
                ...mockScenario,
                repeatTimes: 1,
            } as Scenario;
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(true);
            mockScenariosService.updateScenario.mockResolvedValue(scenarioWithLastExecution);

            await service.execute(scenarioWithLastExecution, { scheduled: true });

            expect(mockScenariosService.updateScenario).toHaveBeenCalledWith('scenario-1', {
                active: false,
                repeatTimes: null,
            });
        });

        it('should handle errors gracefully', async () => {
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockImplementation(() => {
                throw new Error('Evaluation error');
            });

            await expect(service.execute(mockScenario as Scenario, { scheduled: true })).resolves.not.toThrow();
            expect(mockEventEmitter.emit).not.toHaveBeenCalled();
        });

        it('should execute multiple device actions', async () => {
            const scenarioWithMultipleDevices = {
                ...mockScenario,
                devices: [
                    { externalId: 'device-1', set: { controls: { on: true } } },
                    { externalId: 'device-2', set: { controls: { brightness: 50 } } },
                ],
            } as unknown as Scenario;
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(true);

            await service.execute(scenarioWithMultipleDevices, { scheduled: true });

            const events = emittedDeviceUpdates();
            expect(events).toHaveLength(2);
            expect(events[0].selector).toEqual({ externalId: 'device-1' });
            expect(events[0].update.controls).toEqual({ on: true });
            expect(events[1].selector).toEqual({ externalId: 'device-2' });
            expect(events[1].update.controls).toEqual({ brightness: 50 });
        });

        it('should skip device actions without controls', async () => {
            const scenarioWithoutControls = {
                ...mockScenario,
                devices: [{ externalId: 'device-1', set: {} }],
            } as unknown as Scenario;
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(true);

            await service.execute(scenarioWithoutControls, { scheduled: true });

            expect(mockEventEmitter.emit).not.toHaveBeenCalled();
        });

        it('should still update repeatTimes when a device action carries no controls', async () => {
            const scenarioWithoutControls = {
                ...mockScenario,
                repeatTimes: 2,
                devices: [{ externalId: 'device-1', set: {} }],
            } as unknown as Scenario;
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(true);

            await service.execute(scenarioWithoutControls, { scheduled: true });

            expect(mockScenariosService.updateScenario).toHaveBeenCalledWith('scenario-1', { repeatTimes: 1 });
        });
    });

    describe('onDeviceUpdateCompleted', () => {
        it('should trigger related scenarios when controls were updated', async () => {
            const event = new DeviceUpdateCompletedEvent('device-1', true, false);
            mockScenariosService.getDeviceTriggeredScenarios.mockResolvedValue([mockScenario]);
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(false);

            await service.onDeviceUpdateCompleted(event);

            expect(mockScenariosService.getDeviceTriggeredScenarios).toHaveBeenCalledWith('device-1');
        });

        it('should trigger related scenarios when only measurements were updated', async () => {
            const event = new DeviceUpdateCompletedEvent('device-1', false, true);
            mockScenariosService.getDeviceTriggeredScenarios.mockResolvedValue([mockScenario]);
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(false);

            await service.onDeviceUpdateCompleted(event);

            expect(mockScenariosService.getDeviceTriggeredScenarios).toHaveBeenCalledWith('device-1');
        });

        it('should trigger related scenarios only once when both controls and measurements were updated', async () => {
            // Regression: a single Zigbee message carrying both `action` and `battery`/`linkquality`
            // used to fire two events and run every related scenario twice.
            const event = new DeviceUpdateCompletedEvent('device-1', true, true);
            mockScenariosService.getDeviceTriggeredScenarios.mockResolvedValue([mockScenario]);
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(false);

            await service.onDeviceUpdateCompleted(event);

            expect(mockScenariosService.getDeviceTriggeredScenarios).toHaveBeenCalledTimes(1);
        });

        it('should evaluate the triggered scenarios directly without re-fetching them', async () => {
            // The triggered scenarios returned by getDeviceTriggeredScenarios are passed straight
            // to execute(), so there is no redundant getScenarioByExternalId lookup per scenario.
            const event = new DeviceUpdateCompletedEvent('device-1', true, false);
            mockScenariosService.getDeviceTriggeredScenarios.mockResolvedValue([mockScenario]);
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(true);

            await service.onDeviceUpdateCompleted(event);

            expect(mockScenariosService.getScenarioByExternalId).not.toHaveBeenCalled();
            expect(mockConditionsEvaluatorService.evaluateTriggerExpression).toHaveBeenCalledWith('1', [false]);
        });

        it('should not trigger any scenarios when neither controls nor measurements were updated', async () => {
            const event = new DeviceUpdateCompletedEvent('device-1', false, false);

            await service.onDeviceUpdateCompleted(event);

            expect(mockScenariosService.getDeviceTriggeredScenarios).not.toHaveBeenCalled();
        });
    });

    describe('onDeviceCommandExecuted', () => {
        it('should trigger related scenarios with command payload', async () => {
            const command = { action: 'on_press' };
            const event = new DeviceCommandExecutedEvent('device-1', command);
            mockScenariosService.getDeviceTriggeredScenarios.mockResolvedValue([mockScenario]);
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(false);

            await service.onDeviceCommandExecuted(event);

            expect(mockScenariosService.getDeviceTriggeredScenarios).toHaveBeenCalledWith('device-1');
        });

        it('should pass command to condition evaluator', async () => {
            const scenarioWithCommandTrigger = {
                ...mockScenario,
                trigger: {
                    sources: [
                        {
                            type: ScenarioTriggerSourceType.Device,
                            device: { externalId: 'device-1', commands: { are: { action: 'on_press' } } },
                        },
                    ],
                    logic: '1',
                },
            } as unknown as Scenario;
            const command = { action: 'on_press' };
            const event = new DeviceCommandExecutedEvent('device-1', command);
            mockScenariosService.getDeviceTriggeredScenarios.mockResolvedValue([scenarioWithCommandTrigger]);
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(mockDevice);
            mockConditionsEvaluatorService.deviceConditionIsMet.mockReturnValue(true);
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(true);

            await service.onDeviceCommandExecuted(event);

            expect(mockConditionsEvaluatorService.deviceConditionIsMet).toHaveBeenCalledWith(
                scenarioWithCommandTrigger.trigger.sources[0],
                expect.objectContaining({
                    device: mockDevice,
                    commands: command,
                }),
            );
        });

        it('should execute scenario actions when command conditions are met', async () => {
            const scenarioWithCommandTrigger = {
                ...mockScenario,
                trigger: {
                    sources: [
                        {
                            type: ScenarioTriggerSourceType.Device,
                            device: { externalId: 'device-1', commands: { are: { action: 'on_press' } } },
                        },
                    ],
                    logic: '1',
                },
            } as unknown as Scenario;
            const command = { action: 'on_press' };
            const event = new DeviceCommandExecutedEvent('device-1', command);
            mockScenariosService.getDeviceTriggeredScenarios.mockResolvedValue([scenarioWithCommandTrigger]);
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(mockDevice);
            mockConditionsEvaluatorService.deviceConditionIsMet.mockReturnValue(true);
            mockConditionsEvaluatorService.evaluateTriggerExpression.mockReturnValue(true);

            await service.onDeviceCommandExecuted(event);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                DeviceUpdateRequestedEvent.eventName,
                expect.objectContaining({ selector: { externalId: 'device-1' } }),
            );
        });
    });
});
