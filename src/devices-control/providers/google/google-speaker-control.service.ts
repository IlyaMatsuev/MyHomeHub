import * as CastClient from 'castv2-promise';
import TextToSpeech from 'google-tts-api';
import { ClassConstructor } from 'class-transformer/types/interfaces';
import { DevicesControlService } from 'devices-control/devices-control.service';
import { GoogleSpeakerControlsDto } from 'devices-control/providers';
import { TransportMessage } from 'devices-control/interfaces';

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

        // This is the only one exception and probably the only smart google device I'll ever have
        let castClient: CastClient;
        try {
            castClient = await CastClient.find(this.getDeviceIP());
            await castClient.play(await TextToSpeech(controls.text));
        } finally {
            await castClient?.close();
        }

        // I don't want anything else to be sent, so return null message
        return null;
    }
}
