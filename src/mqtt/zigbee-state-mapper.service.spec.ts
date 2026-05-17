import { ZigbeeStateMapperService } from './zigbee-state-mapper.service';

describe('ZigbeeStateMapperService', () => {
    let service: ZigbeeStateMapperService;

    beforeEach(() => {
        service = new ZigbeeStateMapperService();
    });

    describe('mapState', () => {
        describe('controls mapping', () => {
            it('should map ON state to on: true', () => {
                const result = service.mapState({ state: 'ON' });

                expect(result.controls.on).toBe(true);
            });

            it('should map OFF state to on: false', () => {
                const result = service.mapState({ state: 'OFF' });

                expect(result.controls.on).toBe(false);
            });
        });

        describe('measurements mapping', () => {
            it('should map battery level', () => {
                const result = service.mapState({ battery: 85 });

                expect(result.measurements.battery).toBe(85);
            });
        });

        describe('mixed payload', () => {
            it('should separate controls and measurements', () => {
                const z2mPayload = {
                    state: 'ON',
                    battery: 90,
                };

                const result = service.mapState(z2mPayload);

                expect(result.controls).toEqual({ on: true });
                expect(result.measurements).toEqual({ battery: 90 });
            });

            it('should ignore keys outside the supported sets', () => {
                const z2mPayload = {
                    state: 'ON',
                    brightness: 200,
                    linkquality: 100,
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
