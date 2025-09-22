export class PairAcceptDto {
    accepted: boolean;
    deviceId?: string;
    updateInterval?: number;
    controls: Record<string, unknown>;
    message?: string;

    constructor(dto?: Partial<PairAcceptDto>) {
        if (dto) {
            Object.assign(this, dto);
        }
    }

    static accept(deviceId: string, controls: Record<string, unknown>, updateInterval: number): PairAcceptDto {
        return new PairAcceptDto({ accepted: true, deviceId, controls, updateInterval });
    }

    static reject(message: string): PairAcceptDto {
        return new PairAcceptDto({ accepted: false, message });
    }
}
