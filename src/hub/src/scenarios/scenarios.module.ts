import { Module } from '@nestjs/common';
import { DatabaseModule } from 'db/db.module';
import { ScenariosController } from 'scenarios/scenarios.controller';
import { ScenariosService } from 'scenarios/scenarios.service';
import { scenariosProviders } from 'scenarios/scenarios.providers';

@Module({
    imports: [DatabaseModule],
    controllers: [ScenariosController],
    providers: [ScenariosService, ...scenariosProviders],
})
export class ScenariosModule {}
