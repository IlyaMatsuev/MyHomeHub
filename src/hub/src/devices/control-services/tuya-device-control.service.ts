import { TuyaContext, TuyaResponse } from '@tuya/tuya-connector-nodejs';
import { DeviceControlService } from 'devices/control-services';

const CONTROLS_TO_TUYA_COMMANDS = {
    // Example value: true/false
    on: 'switch_led',
    // Example value: 10 - 1000
    brightness: 'bright_value',
    // Example value: { h: 240, s: 1000, v: 1000 }
    // - h (hue): 0 - 360
    // - s (saturation): 0 - 255
    // - v (value): 0 - 255
    color: 'colour_data',
};

export class TuyaDeviceControlService extends DeviceControlService {
    private tuya: TuyaContext;

    protected getServiceName(): string {
        return TuyaDeviceControlService.name;
    }

    async setControls(controls: Record<string, unknown>): Promise<void> {
        const tuyaDeviceId = this.getTuyaDeviceId();
        await this.executeCommand(tuyaDeviceId, controls);
    }

    private getTuyaDeviceId(): string | never {
        // TODO: Move to a separate field
        const deviceId = this.device.measurements.deviceId as string;
        if (!deviceId || typeof deviceId !== 'string') {
            throw new Error(`The Tuya device with id "${this.device.externalId}" is missing a Tuya device Id`);
        }
        return this.device.measurements.deviceId as string;
    }

    private executeCommand(tuyaDeviceId: string, controls: Record<string, unknown>): Promise<TuyaResponse<unknown>> {
        const commands = Object.keys(controls)
            .filter(control => !!CONTROLS_TO_TUYA_COMMANDS[control])
            .map(control => ({ code: CONTROLS_TO_TUYA_COMMANDS[control], value: controls[control] }));

        if (!commands.length) {
            throw new Error(
                `None of the provided controls are supported by a Tuya device "${this.device.externalId}": ${JSON.stringify(Object.keys(controls))}`,
            );
        }

        return this.getTuyaContext().request({
            method: 'POST',
            path: `/v1.0/iot-03/devices/${tuyaDeviceId}/commands`,
            body: { commands },
        });
    }

    private getTuyaContext(): TuyaContext {
        if (!this.tuya) {
            this.tuya = new TuyaContext({
                baseUrl: this.configService.get<string>('TUYA_PROJECT_URL'),
                accessKey: this.configService.get<string>('TUYA_PROJECT_CLIENT_ID'),
                secretKey: this.configService.get<string>('TUYA_PROJECT_CLIENT_SECRET'),
            });
        }
        return this.tuya;
    }
}
