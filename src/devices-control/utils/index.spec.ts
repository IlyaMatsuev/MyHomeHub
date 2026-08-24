import { DeviceControls } from 'devices/interfaces';
import { stripEmptyValues } from './index';

describe('stripEmptyValues', () => {
    it('should remove the controls that are still seeded with null', () => {
        const payload = { on: true, brightness: null, color: null } as DeviceControls;

        expect(stripEmptyValues(payload)).toEqual({ on: true });
    });

    it('should remove the undefined values', () => {
        expect(stripEmptyValues({ on: true, mode: undefined })).toEqual({ on: true });
    });

    it.each([
        ['false', false],
        ['zero', 0],
        ['an empty string', ''],
    ])('should keep %s, since it is a real device state', (_label, value) => {
        expect(stripEmptyValues({ on: value })).toEqual({ on: value });
    });

    it('should keep the nested payloads as they are', () => {
        const speedLevels = { 0.5: { lowTemp: 20, highTemp: 30 } };

        expect(stripEmptyValues({ speedLevels })).toEqual({ speedLevels });
    });

    it('should not mutate the provided payload', () => {
        const payload = { on: true, brightness: null } as DeviceControls;

        stripEmptyValues(payload);

        expect(payload).toEqual({ on: true, brightness: null });
    });

    it('should return an empty payload when every value is empty', () => {
        expect(stripEmptyValues({ on: null, brightness: undefined })).toEqual({});
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
    ])('should return %s as is instead of throwing', (_label, payload) => {
        expect(stripEmptyValues(payload as unknown as DeviceControls)).toBe(payload);
    });
});
