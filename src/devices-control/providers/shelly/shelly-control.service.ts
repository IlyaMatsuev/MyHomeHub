import { ClassConstructor } from 'class-transformer/types/interfaces';
import { ShellyControlsDto } from './shelly-controls.dto';
import {
    SHELLY_COMPONENT_CONTROLS,
    SHELLY_CONTROL_PARAMS,
    SHELLY_RPC_COMPONENT_ID,
    SHELLY_STATUS_CONTROLS,
    ShellyComponent,
} from './shelly.constants';
import { DeviceControls, DevicePayload } from 'devices/interfaces';
import { DevicesControlService } from 'devices-control/devices-control.service';
import { TransportMessage } from 'devices-control/interfaces';
import { DeviceConfigPayloads } from 'device-configs/interfaces';

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

    protected getStatePayload(): TransportMessage {
        return {
            url: `http://${this.getDeviceIP()}/rpc`,
            method: 'POST',
            payload: {
                id: 1,
                // The state is read from the primary component of the device, the one all its controls belong to
                method: `${this.getComponents()[0]}.GetStatus`,
                params: {
                    id: SHELLY_RPC_COMPONENT_ID,
                },
            },
        };
    }

    protected parseStatePayload(response: unknown): DeviceConfigPayloads | never {
        const status = (response as { result?: DevicePayload })?.result;
        if (!status || typeof status !== 'object') {
            throw new Error(`The device "${this.device.externalId}" returned an unexpected status: ${JSON.stringify(response)}`);
        }
        return { controls: this.getStatusControls(status), measurements: this.getStatusMeasurements(status) };
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

    private getStatusControls(status: DevicePayload): DeviceControls {
        const controls: DeviceControls = {};
        for (const [name, param] of Object.entries(SHELLY_STATUS_CONTROLS)) {
            const value = status[param.namePath];
            if (value === undefined || value === null) {
                continue;
            }
            controls[name] = param.transform ? param.transform(value) : value;
        }
        return controls;
    }

    // Every status field the controls do not consume is a measurement candidate. The nested objects (e.g. "aenergy") are skipped,
    // and the names the device config does not declare are dropped by the device config validation later on
    private getStatusMeasurements(status: DevicePayload): DevicePayload {
        const controlPaths = new Set(Object.values(SHELLY_STATUS_CONTROLS).map(param => param.namePath));
        const measurements: DevicePayload = {};
        for (const [name, value] of Object.entries(status)) {
            if (!controlPaths.has(name) && (value === null || typeof value !== 'object')) {
                measurements[name] = value;
            }
        }
        return measurements;
    }

    private getControlNames(controls: DeviceControls): Array<string> {
        return Object.keys(controls).filter(name => name !== '$override' && controls[name] !== undefined && controls[name] !== null);
    }
}
