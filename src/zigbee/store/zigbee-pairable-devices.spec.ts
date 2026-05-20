import { ZigbeePairableDevices } from './zigbee-pairable-devices';
import { PairableDevice, ZigbeeDevice } from 'zigbee/interfaces';

describe('ZigbeePairableDevices', () => {
    const getCache = (): Map<string, PairableDevice> =>
        (ZigbeePairableDevices as unknown as { pairableDevices: Map<string, PairableDevice> }).pairableDevices;

    const setCache = (entries: Array<[string, PairableDevice]>): void => {
        (ZigbeePairableDevices as unknown as { pairableDevices: Map<string, PairableDevice> }).pairableDevices = new Map(entries);
    };

    const makeZigbeeDevice = (overrides: Partial<ZigbeeDevice> = {}): ZigbeeDevice => ({
        ieee_address: '0x111',
        friendly_name: 'bulb_1',
        type: 'EndDevice',
        supported: true,
        disabled: false,
        interview_completed: true,
        interview_state: 'SUCCESSFUL',
        definition: { model: 'M1', vendor: 'V', description: 'D' },
        ...overrides,
    });

    beforeEach(() => {
        setCache([]);
    });

    describe('save', () => {
        it('should store eligible devices keyed by ieee address', () => {
            ZigbeePairableDevices.save([
                makeZigbeeDevice({ ieee_address: '0x001', friendly_name: 'bulb_a' }),
                makeZigbeeDevice({ ieee_address: '0x002', friendly_name: 'bulb_b' }),
            ]);

            const cache = getCache();
            expect(cache.size).toBe(2);
            expect(cache.get('0x001')).toEqual({ zigbeeIeeeAddress: '0x001', zigbeeFriendlyName: 'bulb_a' });
            expect(cache.get('0x002')).toEqual({ zigbeeIeeeAddress: '0x002', zigbeeFriendlyName: 'bulb_b' });
        });

        it('should filter out the Coordinator', () => {
            ZigbeePairableDevices.save([
                makeZigbeeDevice({ ieee_address: '0x001', type: 'Coordinator' }),
                makeZigbeeDevice({ ieee_address: '0x002' }),
            ]);

            const cache = getCache();
            expect(cache.has('0x001')).toBe(false);
            expect(cache.has('0x002')).toBe(true);
        });

        it('should filter out unsupported devices', () => {
            ZigbeePairableDevices.save([makeZigbeeDevice({ ieee_address: '0x001', supported: false })]);

            expect(getCache().size).toBe(0);
        });

        it('should filter out disabled devices', () => {
            ZigbeePairableDevices.save([makeZigbeeDevice({ ieee_address: '0x001', disabled: true })]);

            expect(getCache().size).toBe(0);
        });

        it('should filter out devices whose interview has not completed', () => {
            ZigbeePairableDevices.save([makeZigbeeDevice({ ieee_address: '0x001', interview_completed: false })]);

            expect(getCache().size).toBe(0);
        });

        it('should filter out devices whose interview state is not SUCCESSFUL', () => {
            ZigbeePairableDevices.save([
                makeZigbeeDevice({ ieee_address: '0x001', interview_state: 'FAILED' }),
                makeZigbeeDevice({ ieee_address: '0x002', interview_state: 'IN_PROGRESS' }),
                makeZigbeeDevice({ ieee_address: '0x003', interview_state: 'PENDING' }),
            ]);

            expect(getCache().size).toBe(0);
        });

        it('should replace the previously cached devices', () => {
            ZigbeePairableDevices.save([makeZigbeeDevice({ ieee_address: '0xold' })]);
            ZigbeePairableDevices.save([makeZigbeeDevice({ ieee_address: '0xnew' })]);

            const cache = getCache();
            expect(cache.has('0xold')).toBe(false);
            expect(cache.has('0xnew')).toBe(true);
        });
    });

    describe('has', () => {
        it('should return true when the device is cached', () => {
            setCache([['0x001', { zigbeeIeeeAddress: '0x001', zigbeeFriendlyName: 'bulb_a' }]]);

            expect(ZigbeePairableDevices.has('0x001')).toBe(true);
        });

        it('should return false when the device is not cached', () => {
            expect(ZigbeePairableDevices.has('0xmissing')).toBe(false);
        });
    });

    describe('get', () => {
        it('should return the cached device when present', () => {
            const pairable = { zigbeeIeeeAddress: '0x001', zigbeeFriendlyName: 'bulb_a' };
            setCache([['0x001', pairable]]);

            expect(ZigbeePairableDevices.get('0x001')).toEqual(pairable);
        });

        it('should return null when no device matches', () => {
            expect(ZigbeePairableDevices.get('0xmissing')).toBeNull();
        });
    });

    describe('getAll', () => {
        it('should return all cached devices as an array', () => {
            const a = { zigbeeIeeeAddress: '0x001', zigbeeFriendlyName: 'bulb_a' };
            const b = { zigbeeIeeeAddress: '0x002', zigbeeFriendlyName: 'bulb_b' };
            setCache([
                ['0x001', a],
                ['0x002', b],
            ]);

            expect(ZigbeePairableDevices.getAll()).toEqual([a, b]);
        });

        it('should return an empty array when nothing is cached', () => {
            expect(ZigbeePairableDevices.getAll()).toEqual([]);
        });
    });
});
