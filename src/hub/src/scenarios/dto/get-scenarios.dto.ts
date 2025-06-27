import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { PaginationDto } from 'common/dto';

@ApiSchema({ name: 'GetScenariosParameters', description: 'Parameters used to query scenarios' })
export class GetScenariosDto extends PaginationDto {
    @ApiProperty({
        required: false,
        default: false,
        description: 'Determines if the response should also include inactive scenarios',
    })
    includeInactive: boolean = false;
}
