import { ApiSchema } from '@nestjs/swagger';
import { DeviceControlsDto } from 'devices/dto';

@ApiSchema({ name: 'Devices.Shelly.Controls', description: 'DTO describing the structure of Shelly device controls' })
export class ShellyControlsDto extends DeviceControlsDto {}
