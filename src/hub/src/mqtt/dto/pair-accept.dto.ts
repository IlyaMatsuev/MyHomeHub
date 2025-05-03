export class PairAcceptDto {
    accepted: boolean;
    deviceId?: string;
    updateInterval?: number;
    message?: string;

    constructor(dto?: Partial<PairAcceptDto>) {
        if (dto) {
            Object.assign(this, dto);
        }
    }

    static accept(deviceId: string, updateInterval: number): PairAcceptDto {
        return new PairAcceptDto({ accepted: true, deviceId, updateInterval });
    }

    static reject(message: string): PairAcceptDto {
        return new PairAcceptDto({ accepted: false, message });
    }
}
