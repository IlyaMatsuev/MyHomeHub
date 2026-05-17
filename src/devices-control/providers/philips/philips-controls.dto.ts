import { ApiSchema } from '@nestjs/swagger';
import { DeviceControlsDto } from 'devices/dto';

@ApiSchema({ name: 'PhilipsControls', description: 'DTO describing the structure of Philips device controls' })
export class PhilipsControlsDto extends DeviceControlsDto {}
