import * as CastClient from 'castv2-promise';
import TextToSpeech from 'google-tts-api';
import { ClassConstructor } from 'class-transformer/types/interfaces';
import { DevicesControlService } from 'devices-control/devices-control.service';
import { GoogleSpeakerControlsDto } from 'devices-control/google/google-speaker-controls.dto';

export class GoogleSpeakerControlService extends DevicesControlService {
    protected getServiceName(): string {
        return GoogleSpeakerControlService.name;
    }

    protected getControlsDtoType<T extends object>(): ClassConstructor<T> {
        return GoogleSpeakerControlsDto as ClassConstructor<T>;
    }

    protected async setDeviceControls(controls: GoogleSpeakerControlsDto): Promise<void | never> {
        if (!controls.text) {
            return;
        }

        let castClient: CastClient;
        try {
            castClient = await CastClient.find(this.getDeviceIP());
            await castClient.play(await TextToSpeech(controls.text));
        } finally {
            await castClient?.close();
        }
    }
}
