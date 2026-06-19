import { Module } from '@nestjs/common';
import { DatabaseModule } from 'db/db.module';
import { UsersController } from 'users/users.controller';
import { UsersService } from 'users/users.service';
import { RegistrationRequestsService } from 'users/registration-requests.service';
import { usersProviders } from 'users/users.providers';

@Module({
    imports: [DatabaseModule],
    controllers: [UsersController],
    providers: [UsersService, RegistrationRequestsService, ...usersProviders],
    exports: [UsersService, RegistrationRequestsService],
})
export class UsersModule {}
