import { Injectable } from '@nestjs/common';
import { ScenarioDeviceTriggerSource } from 'scenarios/interfaces';
import { Device, DevicePayload } from 'devices/interfaces';

const OPERATOR_OR = 'OR';
const OPERATOR_AND = 'AND';

type TriggerExpressionToken = typeof OPERATOR_OR | typeof OPERATOR_AND | number | Array<TriggerExpressionToken>;
type TriggerExpression = Array<TriggerExpressionToken>;

export interface DeviceConditionContext {
    device: Device;
    command?: DevicePayload;
}

@Injectable()
export class ConditionsEvaluatorService {
    deviceConditionIsMet(triggerSource: ScenarioDeviceTriggerSource, context: DeviceConditionContext): boolean {
        const controlsConditions = triggerSource.device.controls?.are;
        const measurementsConditions = triggerSource.device.measurements?.are;
        const commandsConditions = triggerSource.device.commands?.are;

        const meetsConditions = (conditions: Record<string, object>, payload: DevicePayload) => {
            if (!conditions) {
                return true;
            }
            if (!payload) {
                return false;
            }
            return Object.keys(conditions).reduce((res, field) => res && payload[field] === conditions[field], true);
        };
        return (
            meetsConditions(controlsConditions, context.device.controls) &&
            meetsConditions(measurementsConditions, context.device.measurements) &&
            meetsConditions(commandsConditions, context.command)
        );
    }

    evaluateTriggerExpression(expressionLogic: string, conditions: Array<boolean>): boolean {
        const expressionTokens = this.extractTriggerExpressionTokens(expressionLogic);
        const triggerExpression = this.parseTriggerExpression(expressionTokens);
        return this.evaluateExpression(triggerExpression, conditions);
    }

    private extractTriggerExpressionTokens(expression: string): Array<string> {
        return expression.match(/\(|\)|\d+|AND|OR/g);
    }

    private parseTriggerExpression(expressionTokens: Array<string>): TriggerExpression {
        const parsedExpression: TriggerExpression = [];
        let expressionGroup = [];

        while (expressionTokens.length) {
            const token = expressionTokens.shift();

            if (token === '(') {
                expressionGroup.push(this.parseTriggerExpression(expressionTokens));
            } else if (token === ')') {
                break;
            } else if (token === OPERATOR_OR || token === OPERATOR_AND) {
                if (expressionGroup.length) {
                    parsedExpression.push(expressionGroup.length > 1 ? expressionGroup : expressionGroup[0]);
                    expressionGroup = [];
                }
                parsedExpression.push(token);
            } else {
                parsedExpression.push(+token);
            }
        }

        if (expressionGroup.length) {
            parsedExpression.push(expressionGroup.length > 1 ? expressionGroup : expressionGroup[0]);
        }
        return parsedExpression;
    }

    private evaluateExpression(expression: TriggerExpression, conditions: Array<boolean>): boolean {
        let result: boolean = undefined;
        let operator: typeof OPERATOR_OR | typeof OPERATOR_AND = undefined;
        for (const expressionItem of expression) {
            if (expressionItem === OPERATOR_OR || expressionItem === OPERATOR_AND) {
                operator = expressionItem;
            } else {
                const condition =
                    typeof expressionItem === 'number'
                        ? conditions[expressionItem - 1]
                        : this.evaluateExpression(expressionItem, conditions);
                if (result !== undefined && operator !== undefined) {
                    if (operator === OPERATOR_OR) {
                        result ||= condition;
                    }
                    if (operator === OPERATOR_AND) {
                        result &&= condition;
                    }
                } else {
                    result = condition;
                }
            }
        }
        return result;
    }
}
