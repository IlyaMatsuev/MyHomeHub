import * as CastClient from 'castv2-promise';
import * as textToSpeech from 'google-tts-api';
import { DeviceControlService } from 'devices/control-services/device-control.service';
import { Device } from 'devices/interfaces';

export class GoogleSpeakerDeviceControlService extends DeviceControlService {
    constructor(protected readonly device: Device) {
        super(device, GoogleSpeakerDeviceControlService.name);
    }

    async setControls<T>(controls: Record<string, unknown>): Promise<T> {
        const speechText = controls.text as string;
        // TODO: Move deviceCastName to a separate field
        const deviceName = this.device.measurements.name as string;

        if (!speechText) {
            return;
        }

        if (!deviceName) {
            this.logger.warn(
                `Cannot set the controls for device "${this.device.externalId}". The Google Device name is missing: measurements.name = ${deviceName}`,
            );
            return;
        }

        try {
            const castClient = await CastClient.find(deviceName);
            await castClient.play(await textToSpeech(speechText));
            await castClient.close();
        } catch (error) {
            this.logger.error(`Was not able to find a device or play the media file: ${error}`);
        }
    }
}
