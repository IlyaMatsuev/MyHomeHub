import { Injectable } from '@nestjs/common';
import TuyaDevice from 'tuyapi';
import { DeviceTransportService, TransportProtocol, TuyaMessage } from 'devices-control/interfaces';

const TUYA_DEVICE_PROTOCOL_VERSION = '3.3';

@Injectable()
export class TuyaTransportService implements DeviceTransportService {
    readonly protocol = TransportProtocol.Tuya;

    async send(message: TuyaMessage): Promise<void> {
        const tuyaDevice = new TuyaDevice({
            id: message.tuyaId,
            ip: message.ip,
            key: message.localKey,
            version: TUYA_DEVICE_PROTOCOL_VERSION,
        });

        try {
            await this.connectTuyaDevice(tuyaDevice);
            await tuyaDevice.set({ multiple: true, data: message.payload });
        } finally {
            tuyaDevice.disconnect();
        }
    }

    private connectTuyaDevice(tuyaDevice: TuyaDevice): Promise<void> {
        // This promise wrapper is needed because when an error happens, it sends the actual error only by event, not in exception
        return new Promise<void>((resolve, reject) => {
            tuyaDevice.on('error', reject);
            tuyaDevice
                .connect()
                .then(() => resolve())
                .catch(reject);
        });
    }
}
