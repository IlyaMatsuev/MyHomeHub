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

            it('should scale brightness from 0-254 to 0-100', () => {
                const result = service.mapState({ brightness: 127 });

                expect(result.controls.brightness).toBe(50);
            });

            it('should handle brightness at max (254)', () => {
                const result = service.mapState({ brightness: 254 });

                expect(result.controls.brightness).toBe(100);
            });

            it('should handle brightness at min (0)', () => {
                const result = service.mapState({ brightness: 0 });

                expect(result.controls.brightness).toBe(0);
            });

            it('should extract hex color', () => {
                const result = service.mapState({ color: { hex: '#FF0000' } });

                expect(result.controls.color).toBe('#FF0000');
            });

            it('should map color_temp to colorTemp', () => {
                // eslint-disable-next-line camelcase
                const result = service.mapState({ color_temp: 250 });

                expect(result.controls.colorTemp).toBe(250);
            });

            it('should map color_mode', () => {
                // eslint-disable-next-line camelcase
                const result = service.mapState({ color_mode: 'color_temp' });

                expect(result.controls.colorMode).toBe('color_temp');
            });
        });

        describe('measurements mapping', () => {
            it('should map battery level', () => {
                const result = service.mapState({ battery: 85 });

                expect(result.measurements.battery).toBe(85);
            });

            it('should map link quality', () => {
                const result = service.mapState({ linkquality: 120 });

                expect(result.measurements.linkquality).toBe(120);
            });

            it('should map temperature', () => {
                const result = service.mapState({ temperature: 22.5 });

                expect(result.measurements.temperature).toBe(22.5);
            });

            it('should map humidity', () => {
                const result = service.mapState({ humidity: 60 });

                expect(result.measurements.humidity).toBe(60);
            });

            it('should map occupancy (motion)', () => {
                const result = service.mapState({ occupancy: true });

                expect(result.measurements.occupancy).toBe(true);
            });

            it('should map contact state', () => {
                const result = service.mapState({ contact: false });

                expect(result.measurements.contact).toBe(false);
            });

            it('should map power consumption', () => {
                const result = service.mapState({ power: 45.5 });

                expect(result.measurements.power).toBe(45.5);
            });

            it('should map energy', () => {
                const result = service.mapState({ energy: 1234.5 });

                expect(result.measurements.energy).toBe(1234.5);
            });
        });

        describe('mixed payload', () => {
            it('should separate controls and measurements from bulb payload', () => {
                const z2mPayload = {
                    state: 'ON',
                    brightness: 200,
                    linkquality: 100,
                };

                const result = service.mapState(z2mPayload);

                expect(result.controls).toEqual({
                    on: true,
                    brightness: 79,
                });
                expect(result.measurements).toEqual({
                    linkquality: 100,
                });
            });

            it('should handle sensor payload', () => {
                const z2mPayload = {
                    temperature: 23.5,
                    humidity: 55,
                    battery: 90,
                    linkquality: 150,
                };

                const result = service.mapState(z2mPayload);

                expect(result.controls).toEqual({});
                expect(result.measurements).toEqual({
                    temperature: 23.5,
                    humidity: 55,
                    battery: 90,
                    linkquality: 150,
                });
            });

            it('should handle plug with power monitoring', () => {
                const z2mPayload = {
                    state: 'ON',
                    power: 150.5,
                    energy: 500.25,
                    voltage: 230,
                    current: 0.65,
                };

                const result = service.mapState(z2mPayload);

                expect(result.controls.on).toBe(true);
                expect(result.measurements).toEqual({
                    power: 150.5,
                    energy: 500.25,
                    voltage: 230,
                    current: 0.65,
                });
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

            it('should handle color without hex field', () => {
                const result = service.mapState({ color: { x: 0.5, y: 0.3 } });

                expect(result.controls).toEqual({});
            });
        });
    });
});
