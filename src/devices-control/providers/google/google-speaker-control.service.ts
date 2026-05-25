import CastClient from 'castv2-promise';
import TextToSpeech from 'google-tts-api';
import { ClassConstructor } from 'class-transformer/types/interfaces';
import { DevicesControlService } from 'devices-control/devices-control.service';
import { GoogleSpeakerControlsDto } from 'devices-control/providers';
import { TransportMessage } from 'devices-control/interfaces';

const GOOGLE_CAST_PORT = 8009;

export class GoogleSpeakerControlService extends DevicesControlService {
    protected getServiceName(): string {
        return GoogleSpeakerControlService.name;
    }

    protected getControlsDtoType<T extends object>(): ClassConstructor<T> {
        return GoogleSpeakerControlsDto as ClassConstructor<T>;
    }

    protected async getControlsPayload(controls: GoogleSpeakerControlsDto): Promise<TransportMessage> {
        if (!controls.text) {
            return null;
        }

        // Avoid `CastClient.find()` because it relies on mDNS, which won't work inside a docker container. Construct a device manually instead
        const castClient = new CastClient(this.getDeviceIP(), GOOGLE_CAST_PORT);
        try {
            await castClient.play(await TextToSpeech(controls.text));
        } finally {
            await castClient.close();
        }

        // I don't want anything else to be sent, so return null message
        return null;
    }
}
