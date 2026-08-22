import { ClassConstructor } from 'class-transformer/types/interfaces';
import { ShellyControlsDto } from './shelly-controls.dto';
import { SHELLY_COMPONENT_CONTROLS, SHELLY_CONTROL_PARAMS, SHELLY_RPC_COMPONENT_ID, ShellyComponent } from './shelly.constants';
import { DeviceControls, DevicePayload } from 'devices/interfaces';
import { DevicesControlService } from 'devices-control/devices-control.service';
import { TransportMessage } from 'devices-control/interfaces';

export class ShellyControlService extends DevicesControlService {
    protected getServiceName(): string {
        return ShellyControlService.name;
    }

    protected getControlsDtoType<T extends object>(): ClassConstructor<T> {
        return ShellyControlsDto as ClassConstructor<T>;
    }

    protected async getControlsPayload<T extends DeviceControls>(controls: T): Promise<TransportMessage> {
        return {
            url: `http://${this.getDeviceIP()}/rpc`,
            method: 'POST',
            payload: {
                id: 1,
                method: `${this.resolveComponent(controls)}.Set`,
                params: {
                    id: SHELLY_RPC_COMPONENT_ID,
                    ...this.getRpcParams(controls),
                },
            },
        };
    }

    // Components the device exposes over RPC, can be checked with:
    // https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Shelly/#shellygetcomponents-example
    protected getComponents(): ReadonlyArray<ShellyComponent> {
        return [ShellyComponent.Switch];
    }

    private resolveComponent(controls: DeviceControls): ShellyComponent | never {
        const components = this.getComponents();
        const controlNames = this.getControlNames(controls);
        const component = components.find(c => controlNames.every(name => SHELLY_COMPONENT_CONTROLS[c].includes(name)));
        if (!component) {
            throw new Error(
                `None of the "${components.join(', ')}" components of the device "${this.device.externalId}" supports all the controls: ${controlNames.join(', ')}`,
            );
        }
        return component;
    }

    private getRpcParams(controls: DeviceControls): DevicePayload {
        const params: DevicePayload = {};
        for (const name of this.getControlNames(controls)) {
            const param = SHELLY_CONTROL_PARAMS[name];
            if (!param) {
                this.logger.debug(`Control "${name}" could not be matched with any Shelly params"`);
                continue;
            }

            const shellyParam = param.namePath ?? name;
            if (param.transform) {
                params[shellyParam] = param.transform(controls[name]);
            } else {
                params[shellyParam] = controls[name];
            }
        }
        return params;
    }

    private getControlNames(controls: DeviceControls): Array<string> {
        return Object.keys(controls).filter(name => name !== '$override' && controls[name] !== undefined && controls[name] !== null);
    }
}
