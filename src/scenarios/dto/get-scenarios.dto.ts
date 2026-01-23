import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { PaginationDto } from 'common/dto';
import { IsBoolean } from 'class-validator';

@ApiSchema({ name: 'GetScenariosParameters', description: 'Parameters used to query scenarios' })
export class GetScenariosDto extends PaginationDto {
    @IsBoolean()
    @ApiProperty({
        required: false,
        default: false,
        description: 'Determines if the response should also include inactive scenarios',
    })
    includeInactive: boolean = false;
}
