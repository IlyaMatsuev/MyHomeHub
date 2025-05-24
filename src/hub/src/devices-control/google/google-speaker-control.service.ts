import { DevicesControlService } from 'devices-control/devices-control.service';
import * as CastClient from 'castv2-promise';
import TextToSpeech from 'google-tts-api';

export class GoogleSpeakerControlService extends DevicesControlService {
    protected getServiceName(): string {
        return GoogleSpeakerControlService.name;
    }

    protected async setDeviceControls(controls: Record<string, unknown>): Promise<void | never> {
        const speechText = controls.text as string;

        if (!speechText) {
            return;
        }

        let castClient: CastClient;
        try {
            castClient = await CastClient.find(this.getDeviceIP());
            await castClient.play(await TextToSpeech(speechText));
        } finally {
            await castClient?.close();
        }
    }
}
