import { Esp32ControlsDto } from '../esp32-controls.dto';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_UNLOCK_TIMEOUT_MS, MIN_UNLOCK_TIMEOUT_MS } from './esp32-lock.constants';

export class Esp32LockControlsDto extends Esp32ControlsDto {
    @IsBoolean()
    @IsOptional()
    unlocked?: boolean;

    @IsInt()
    @IsOptional()
    @Min(MIN_UNLOCK_TIMEOUT_MS)
    @Max(MAX_UNLOCK_TIMEOUT_MS)
    unlockedTimeoutMs?: number;
}
