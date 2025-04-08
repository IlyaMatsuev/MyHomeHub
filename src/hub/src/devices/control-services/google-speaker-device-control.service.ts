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

        if (!speechText) {
            return;
        }

        try {
            const castClient = await CastClient.find(this.getDeviceIP());
            await castClient.play(await textToSpeech(speechText));
            await castClient.close();
        } catch (error) {
            this.logger.error(`Was not able to find a device or play the media file: ${error}`);
        }
    }

    private getDeviceIP(): string | never {
        const deviceAddress = this.device.deviceAddress;
        if (!deviceAddress) {
            throw new Error(
                `The Google Speaker with id "${this.device.externalId}" does not have an address, not possible to set the controls`,
            );
        }
        return deviceAddress.slice(deviceAddress.lastIndexOf('/') + 1);
    }
}
