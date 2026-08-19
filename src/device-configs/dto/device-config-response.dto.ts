import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { DeviceConfig, DeviceConfigItem, DeviceConfigItemType, DeviceConfigItemValue } from 'device-configs/interfaces';

@ApiSchema({
    name: 'DeviceConfigs.DeviceConfigItemValue',
    description: 'A possible value of a device config item with its device-side mapping',
})
export class DeviceConfigItemValueDto implements DeviceConfigItemValue {
    @ApiProperty({ description: 'Human-readable label of the value' })
    label: string;

    @ApiProperty({ description: 'Internal name of the value' })
    name: string;

    @ApiPropertyOptional({ description: 'Device-side value the internal value maps to' })
    path?: string;
}

@ApiSchema({ name: 'DeviceConfigs.DeviceConfigItem', description: 'Metadata of a single device command/control/measurement' })
export class DeviceConfigItemDto implements DeviceConfigItem {
    @ApiProperty({ description: 'Human-readable label of the command/control/measurement' })
    label: string;

    @ApiProperty({ description: 'Internal name of the command/control/measurement' })
    name: string;

    @ApiProperty({ description: 'Value type of the command/control/measurement', enum: DeviceConfigItemType })
    type: DeviceConfigItemType;

    @ApiPropertyOptional({ description: 'Description of the command/control/measurement' })
    description?: string;

    @ApiPropertyOptional({ description: 'Device-side field name the internal name maps to' })
    path?: string;

    @ApiPropertyOptional({ description: 'Possible values with their device-side mappings', type: [DeviceConfigItemValueDto] })
    values?: Array<DeviceConfigItemValueDto>;
}

@ApiSchema({ name: 'DeviceConfigs.DeviceConfigResponse', description: 'Device config metadata included in device API responses' })
export class DeviceConfigResponseDto {
    @ApiPropertyOptional({ description: 'Commands available for the device', type: [DeviceConfigItemDto] })
    commands?: Array<DeviceConfigItemDto>;

    @ApiPropertyOptional({ description: 'Controls available for the device', type: [DeviceConfigItemDto] })
    controls?: Array<DeviceConfigItemDto>;

    @ApiPropertyOptional({ description: 'Measurements available for the device', type: [DeviceConfigItemDto] })
    measurements?: Array<DeviceConfigItemDto>;

    static fromConfig(config?: DeviceConfig | null): DeviceConfigResponseDto | undefined {
        if (!config) {
            return undefined;
        }
        const response = new DeviceConfigResponseDto();
        if (config.commands?.length) {
            response.commands = config.commands;
        }
        if (config.controls?.length) {
            response.controls = config.controls;
        }
        if (config.measurements?.length) {
            response.measurements = config.measurements;
        }
        if (!response.commands && !response.controls && !response.measurements) {
            return undefined;
        }
        return response;
    }
}
