import { ConditionsEvaluatorService, DeviceConditionContext } from './conditions-evaluator.service';
import { ScenarioDeviceTriggerSource, ScenarioTriggerSourceType } from 'scenarios/interfaces';
import { Device, DeviceBrand, DevicePayload, DeviceType, Room } from 'devices/interfaces';

describe('ConditionsEvaluatorService', () => {
    let service: ConditionsEvaluatorService;

    beforeEach(() => {
        service = new ConditionsEvaluatorService();
    });

    describe('deviceConditionIsMet', () => {
        const createMockDevice = (controls: Record<string, unknown>, measurements: Record<string, unknown>): Device =>
            ({
                externalId: 'device-1',
                name: 'Test Device',
                type: DeviceType.LED,
                brand: DeviceBrand.Tuya,
                room: Room.LivingRoom,
                controls,
                measurements,
            }) as Device;

        const createContext = (device: Device, command?: DevicePayload): DeviceConditionContext => ({
            device,
            command,
        });

        const createTriggerSource = (
            controlsConditions?: Record<string, unknown>,
            measurementsConditions?: Record<string, unknown>,
            commandsConditions?: Record<string, unknown>,
        ): ScenarioDeviceTriggerSource => ({
            type: ScenarioTriggerSourceType.Device,
            device: {
                externalId: 'device-1',
                controls: controlsConditions ? { are: controlsConditions as Record<string, object> } : undefined,
                measurements: measurementsConditions ? { are: measurementsConditions as Record<string, object> } : undefined,
                commands: commandsConditions ? { are: commandsConditions as Record<string, object> } : undefined,
            },
        });

        it('should return true when no conditions are specified', () => {
            const device = createMockDevice({ on: true }, { temperature: 25 });
            const triggerSource = createTriggerSource(undefined, undefined);

            expect(service.deviceConditionIsMet(triggerSource, createContext(device))).toBe(true);
        });

        it('should return true when controls condition matches', () => {
            const device = createMockDevice({ on: true, brightness: 100 }, {});
            const triggerSource = createTriggerSource({ on: true });

            expect(service.deviceConditionIsMet(triggerSource, createContext(device))).toBe(true);
        });

        it('should return false when controls condition does not match', () => {
            const device = createMockDevice({ on: false, brightness: 100 }, {});
            const triggerSource = createTriggerSource({ on: true });

            expect(service.deviceConditionIsMet(triggerSource, createContext(device))).toBe(false);
        });

        it('should return true when measurements condition matches', () => {
            const device = createMockDevice({}, { temperature: 25, humidity: 60 });
            const triggerSource = createTriggerSource(undefined, { temperature: 25 });

            expect(service.deviceConditionIsMet(triggerSource, createContext(device))).toBe(true);
        });

        it('should return false when measurements condition does not match', () => {
            const device = createMockDevice({}, { temperature: 30, humidity: 60 });
            const triggerSource = createTriggerSource(undefined, { temperature: 25 });

            expect(service.deviceConditionIsMet(triggerSource, createContext(device))).toBe(false);
        });

        it('should return true when both controls and measurements conditions match', () => {
            const device = createMockDevice({ on: true }, { temperature: 25 });
            const triggerSource = createTriggerSource({ on: true }, { temperature: 25 });

            expect(service.deviceConditionIsMet(triggerSource, createContext(device))).toBe(true);
        });

        it('should return false when controls match but measurements do not', () => {
            const device = createMockDevice({ on: true }, { temperature: 30 });
            const triggerSource = createTriggerSource({ on: true }, { temperature: 25 });

            expect(service.deviceConditionIsMet(triggerSource, createContext(device))).toBe(false);
        });

        it('should check multiple control conditions', () => {
            const device = createMockDevice({ on: true, brightness: 100 }, {});
            const triggerSource = createTriggerSource({ on: true, brightness: 100 });

            expect(service.deviceConditionIsMet(triggerSource, createContext(device))).toBe(true);
        });

        it('should return false when one of multiple control conditions fails', () => {
            const device = createMockDevice({ on: true, brightness: 50 }, {});
            const triggerSource = createTriggerSource({ on: true, brightness: 100 });

            expect(service.deviceConditionIsMet(triggerSource, createContext(device))).toBe(false);
        });

        it('should return true when commands condition matches', () => {
            const device = createMockDevice({}, {});
            const command = { action: 'on_press' };
            const triggerSource = createTriggerSource(undefined, undefined, { action: 'on_press' });

            expect(service.deviceConditionIsMet(triggerSource, createContext(device, command))).toBe(true);
        });

        it('should return false when commands condition does not match', () => {
            const device = createMockDevice({}, {});
            const command = { action: 'off_press' };
            const triggerSource = createTriggerSource(undefined, undefined, { action: 'on_press' });

            expect(service.deviceConditionIsMet(triggerSource, createContext(device, command))).toBe(false);
        });

        it('should return false when commands condition is set but no command is provided', () => {
            const device = createMockDevice({}, {});
            const triggerSource = createTriggerSource(undefined, undefined, { action: 'on_press' });

            expect(service.deviceConditionIsMet(triggerSource, createContext(device))).toBe(false);
        });

        it('should return true when controls, measurements and commands conditions all match', () => {
            const device = createMockDevice({ on: true }, { temperature: 25 });
            const command = { action: 'on_press' };
            const triggerSource = createTriggerSource({ on: true }, { temperature: 25 }, { action: 'on_press' });

            expect(service.deviceConditionIsMet(triggerSource, createContext(device, command))).toBe(true);
        });

        it('should return false when commands condition does not match even if others do', () => {
            const device = createMockDevice({ on: true }, { temperature: 25 });
            const command = { action: 'off_press' };
            const triggerSource = createTriggerSource({ on: true }, { temperature: 25 }, { action: 'on_press' });

            expect(service.deviceConditionIsMet(triggerSource, createContext(device, command))).toBe(false);
        });
    });

    describe('evaluateTriggerExpression', () => {
        it('should evaluate single condition', () => {
            expect(service.evaluateTriggerExpression('1', [true])).toBe(true);
            expect(service.evaluateTriggerExpression('1', [false])).toBe(false);
        });

        it('should evaluate OR expression', () => {
            expect(service.evaluateTriggerExpression('1 OR 2', [true, false])).toBe(true);
            expect(service.evaluateTriggerExpression('1 OR 2', [false, true])).toBe(true);
            expect(service.evaluateTriggerExpression('1 OR 2', [true, true])).toBe(true);
            expect(service.evaluateTriggerExpression('1 OR 2', [false, false])).toBe(false);
        });

        it('should evaluate AND expression', () => {
            expect(service.evaluateTriggerExpression('1 AND 2', [true, true])).toBe(true);
            expect(service.evaluateTriggerExpression('1 AND 2', [true, false])).toBe(false);
            expect(service.evaluateTriggerExpression('1 AND 2', [false, true])).toBe(false);
            expect(service.evaluateTriggerExpression('1 AND 2', [false, false])).toBe(false);
        });

        it('should evaluate complex expression with parentheses', () => {
            expect(service.evaluateTriggerExpression('(1 OR 2) AND 3', [true, false, true])).toBe(true);
            expect(service.evaluateTriggerExpression('(1 OR 2) AND 3', [true, false, false])).toBe(false);
            expect(service.evaluateTriggerExpression('(1 AND 2) OR 3', [false, false, true])).toBe(true);
            expect(service.evaluateTriggerExpression('(1 AND 2) OR 3', [false, false, false])).toBe(false);
        });

        it('should evaluate nested parentheses', () => {
            expect(service.evaluateTriggerExpression('((1 AND 2) OR 3) AND 4', [true, true, false, true])).toBe(true);
            expect(service.evaluateTriggerExpression('((1 AND 2) OR 3) AND 4', [false, false, true, true])).toBe(true);
            expect(service.evaluateTriggerExpression('((1 AND 2) OR 3) AND 4', [false, false, true, false])).toBe(false);
        });

        it('should evaluate multiple OR expressions', () => {
            expect(service.evaluateTriggerExpression('1 OR 2 OR 3', [false, false, true])).toBe(true);
            expect(service.evaluateTriggerExpression('1 OR 2 OR 3', [false, false, false])).toBe(false);
        });

        it('should evaluate multiple AND expressions', () => {
            expect(service.evaluateTriggerExpression('1 AND 2 AND 3', [true, true, true])).toBe(true);
            expect(service.evaluateTriggerExpression('1 AND 2 AND 3', [true, true, false])).toBe(false);
        });

        it('should handle mixed operators with left-to-right evaluation', () => {
            // 1 AND 2 OR 3 = (true AND true) OR false = true OR false = true
            expect(service.evaluateTriggerExpression('1 AND 2 OR 3', [true, true, false])).toBe(true);
            // 1 AND 2 OR 3 = (false AND false) OR true = false OR true = true
            expect(service.evaluateTriggerExpression('1 AND 2 OR 3', [false, false, true])).toBe(true);
            // 1 OR 2 AND 3 = (true OR false) AND false = true AND false = false
            expect(service.evaluateTriggerExpression('1 OR 2 AND 3', [true, false, false])).toBe(false);
            // 1 OR 2 AND 3 = (true OR false) AND true = true AND true = true
            expect(service.evaluateTriggerExpression('1 OR 2 AND 3', [true, false, true])).toBe(true);
        });
    });
});
