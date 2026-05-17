import { ZigbeeStateMapperService } from './zigbee-state-mapper.service';

describe('ZigbeeStateMapperService', () => {
    let service: ZigbeeStateMapperService;

    beforeEach(() => {
        service = new ZigbeeStateMapperService();
    });

    describe('mapState', () => {
        describe('controls mapping', () => {
            it('should map on_press action to on: true', () => {
                const result = service.mapState({ action: 'on_press' });

                expect(result.controls.on).toBe(true);
            });

            it('should map off_press action to on: false', () => {
                const result = service.mapState({ action: 'off_press' });

                expect(result.controls.on).toBe(false);
            });

            it('should ignore unmapped action values', () => {
                const result = service.mapState({ action: 'up_press' });

                expect(result.controls).toEqual({});
            });
        });

        describe('measurements mapping', () => {
            it('should map battery level', () => {
                const result = service.mapState({ battery: 85 });

                expect(result.measurements.battery).toBe(85);
            });

            it('should map link quality', () => {
                const result = service.mapState({ linkquality: 100 });

                expect(result.measurements.linkquality).toBe(100);
            });
        });

        describe('mixed payload', () => {
            it('should separate controls and measurements', () => {
                const z2mPayload = {
                    action: 'on_press',
                    battery: 90,
                };

                const result = service.mapState(z2mPayload);

                expect(result.controls).toEqual({ on: true });
                expect(result.measurements).toEqual({ battery: 90 });
            });

            it('should ignore keys outside the supported sets', () => {
                const z2mPayload = {
                    action: 'on_press',
                    brightness: 200,
                    temperature: 23.5,
                };

                const result = service.mapState(z2mPayload);

                expect(result.controls).toEqual({ on: true });
                expect(result.measurements).toEqual({});
            });
        });

        describe('edge cases', () => {
            it('should handle empty payload', () => {
                const result = service.mapState({});

                expect(result.controls).toEqual({});
                expect(result.measurements).toEqual({});
            });

            it('should ignore unknown keys', () => {
                const result = service.mapState({ unknownKey: 'value', anotherUnknown: 123 });

                expect(result.controls).toEqual({});
                expect(result.measurements).toEqual({});
            });
        });
    });
});
