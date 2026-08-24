import { DeviceConfigItem, DeviceConfigItemFormat, DeviceConfigItemType } from 'device-configs/interfaces';
import {
    APPLICABLE_CONSTRAINTS,
    getItemDefaultValue,
    isEmptyValue,
    isNotEmptyValue,
    validateItemValue,
} from './device-config-item.validators';

describe('deviceConfigItemValidators', () => {
    const buildItem = (overrides: Partial<DeviceConfigItem> = {}): DeviceConfigItem =>
        ({ label: 'Label', name: 'name', type: DeviceConfigItemType.String, ...overrides }) as DeviceConfigItem;

    describe('isEmptyValue', () => {
        it.each([
            ['null', null],
            ['undefined', undefined],
        ])('should treat %s as empty', (_label, value) => {
            expect(isEmptyValue(value)).toBe(true);
            expect(isNotEmptyValue(value)).toBe(false);
        });

        it.each([
            ['false', false],
            ['zero', 0],
            ['an empty string', ''],
            ['an empty object', {}],
        ])('should not treat %s as empty', (_label, value) => {
            expect(isEmptyValue(value)).toBe(false);
            expect(isNotEmptyValue(value)).toBe(true);
        });
    });

    describe('getItemDefaultValue', () => {
        it.each([
            ['a declared default', 50, 50],
            ['a falsy declared default', false, false],
            ['a zero declared default', 0, 0],
        ])('should return %s as is', (_label, declared, expected) => {
            expect(getItemDefaultValue(buildItem({ default: declared }))).toBe(expected);
        });

        it('should fall back to null when no default is declared', () => {
            expect(getItemDefaultValue(buildItem())).toBeNull();
        });
    });

    describe('APPLICABLE_CONSTRAINTS', () => {
        it('should allow the numeric constraints for number items only', () => {
            expect(APPLICABLE_CONSTRAINTS[DeviceConfigItemType.Number]).toEqual(['min', 'max', 'integer']);
            expect(APPLICABLE_CONSTRAINTS[DeviceConfigItemType.String]).not.toContain('min');
        });

        it('should allow the string constraints for string items only', () => {
            expect(APPLICABLE_CONSTRAINTS[DeviceConfigItemType.String]).toEqual(['minLength', 'maxLength', 'pattern', 'format']);
            expect(APPLICABLE_CONSTRAINTS[DeviceConfigItemType.Number]).not.toContain('maxLength');
        });

        it.each([DeviceConfigItemType.Boolean, DeviceConfigItemType.Enum, DeviceConfigItemType.Object])(
            'should allow no constraints for %s items',
            type => {
                expect(APPLICABLE_CONSTRAINTS[type]).toEqual([]);
            },
        );
    });

    describe('validateItemValue', () => {
        it.each([
            ['null', null],
            ['undefined', undefined],
        ])('should accept %s regardless of the item type, since presence is enforced by "required"', (_label, value) => {
            expect(validateItemValue(buildItem({ type: DeviceConfigItemType.Number }), value)).toBeNull();
        });

        describe('boolean items', () => {
            it.each([true, false])('should accept the %s boolean', value => {
                expect(validateItemValue(buildItem({ type: DeviceConfigItemType.Boolean }), value)).toBeNull();
            });

            it.each([
                ['a string', 'true'],
                ['a number', 1],
            ])('should reject %s', (_label, value) => {
                expect(validateItemValue(buildItem({ type: DeviceConfigItemType.Boolean }), value)).toBe('"name" must be a boolean value');
            });
        });

        describe('number items', () => {
            const numberItem = (constraints?: DeviceConfigItem['constraints']) =>
                buildItem({ type: DeviceConfigItemType.Number, constraints });

            it('should accept a finite number without constraints', () => {
                expect(validateItemValue(numberItem(), -17.5)).toBeNull();
            });

            it.each([
                ['a numeric string', '42'],
                ['NaN', Number.NaN],
                ['Infinity', Number.POSITIVE_INFINITY],
            ])('should reject %s', (_label, value) => {
                expect(validateItemValue(numberItem(), value)).toBe('"name" must be a number');
            });

            it('should enforce the minimum', () => {
                expect(validateItemValue(numberItem({ min: 10 }), 10)).toBeNull();
                expect(validateItemValue(numberItem({ min: 10 }), 9.99)).toBe('"name" must not be less than 10');
            });

            it('should enforce the maximum', () => {
                expect(validateItemValue(numberItem({ max: 10 }), 10)).toBeNull();
                expect(validateItemValue(numberItem({ max: 10 }), 10.01)).toBe('"name" must not be greater than 10');
            });

            it('should enforce whole numbers', () => {
                expect(validateItemValue(numberItem({ integer: true }), 4)).toBeNull();
                expect(validateItemValue(numberItem({ integer: true }), 4.5)).toBe('"name" must be an integer number');
            });

            it('should enforce a zero boundary instead of ignoring it as a falsy constraint', () => {
                expect(validateItemValue(numberItem({ min: 0 }), -1)).toBe('"name" must not be less than 0');
                expect(validateItemValue(numberItem({ max: 0 }), 1)).toBe('"name" must not be greater than 0');
            });
        });

        describe('string items', () => {
            const stringItem = (constraints?: DeviceConfigItem['constraints']) =>
                buildItem({ type: DeviceConfigItemType.String, constraints });

            it('should accept a string without constraints', () => {
                expect(validateItemValue(stringItem(), 'anything')).toBeNull();
            });

            it.each([
                ['a number', 42],
                ['a boolean', true],
            ])('should reject %s', (_label, value) => {
                expect(validateItemValue(stringItem(), value)).toBe('"name" must be a string');
            });

            it('should enforce the minimum length', () => {
                expect(validateItemValue(stringItem({ minLength: 3 }), 'abc')).toBeNull();
                expect(validateItemValue(stringItem({ minLength: 3 }), 'ab')).toBe('"name" must be longer than or equal to 3 characters');
            });

            it('should enforce the maximum length', () => {
                expect(validateItemValue(stringItem({ maxLength: 3 }), 'abc')).toBeNull();
                expect(validateItemValue(stringItem({ maxLength: 3 }), 'abcd')).toBe(
                    '"name" must be shorter than or equal to 3 characters',
                );
            });

            it('should not enforce a length that is not declared', () => {
                expect(validateItemValue(stringItem({ minLength: 1 }), 'a very long value with no declared maximum')).toBeNull();
            });

            it('should enforce a zero length boundary instead of ignoring it as a falsy constraint', () => {
                expect(validateItemValue(stringItem({ maxLength: 0 }), 'a')).toBe('"name" must be shorter than or equal to 0 characters');
            });

            it('should enforce the pattern', () => {
                expect(validateItemValue(stringItem({ pattern: '^a+$' }), 'aaa')).toBeNull();
                expect(validateItemValue(stringItem({ pattern: '^a+$' }), 'abc')).toBe('"name" must match the ^a+$ pattern');
            });

            it.each([
                [DeviceConfigItemFormat.HexColor, '#FF8800', 'not-a-color'],
                [DeviceConfigItemFormat.Ip, '192.168.1.10', '999.1.1.1'],
                [DeviceConfigItemFormat.Url, 'https://example.com', 'not a url'],
            ])('should enforce the %s format', (format, valid, invalid) => {
                expect(validateItemValue(stringItem({ format }), valid)).toBeNull();
                expect(validateItemValue(stringItem({ format }), invalid)).toBe(`"name" must be a valid ${format} value`);
            });

            it('should reject an IPv6 address for the ip format, since devices are addressed over IPv4', () => {
                expect(validateItemValue(stringItem({ format: DeviceConfigItemFormat.Ip }), '::1')).toBe('"name" must be a valid ip value');
            });
        });

        describe('enum items', () => {
            const enumItem = buildItem({
                type: DeviceConfigItemType.Enum,
                values: [
                    { label: 'Color', name: 'rgb' },
                    { label: 'White', name: 'cct' },
                ],
            });

            it('should accept a declared value', () => {
                expect(validateItemValue(enumItem, 'rgb')).toBeNull();
            });

            it('should reject a value that is not declared', () => {
                expect(validateItemValue(enumItem, 'disco')).toBe('"name" must be one of the following values: rgb, cct');
            });

            it('should compare the declared values as strings', () => {
                const numericEnum = buildItem({ type: DeviceConfigItemType.Enum, values: [{ label: 'One', name: '1' }] });

                expect(validateItemValue(numericEnum, 1)).toBeNull();
            });

            it('should fall back to a string check when no values are declared', () => {
                const valuelessEnum = buildItem({ type: DeviceConfigItemType.Enum });

                expect(validateItemValue(valuelessEnum, 'anything')).toBeNull();
                expect(validateItemValue(valuelessEnum, 42)).toBe('"name" must be a string');
            });
        });

        describe('object items', () => {
            const objectItem = buildItem({ type: DeviceConfigItemType.Object });

            it('should accept an object and delegate its structure to the brand dto', () => {
                expect(validateItemValue(objectItem, { speedLevels: { 0.5: { lowTemp: 20, highTemp: 30 } } })).toBeNull();
            });

            it.each([
                ['an array', []],
                ['a string', 'not an object'],
                ['a number', 42],
            ])('should reject %s', (_label, value) => {
                expect(validateItemValue(objectItem, value)).toBe('"name" must be an object');
            });
        });
    });
});
