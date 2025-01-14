import { Module } from '@nestjs/common';
import { DatabaseModule } from 'db/db.module';
import { UsersService } from 'users/users.service';
import { usersProviders } from 'users/users.providers';

@Module({
    imports: [DatabaseModule],
    providers: [UsersService, ...usersProviders],
    exports: [UsersService],
})
export class UsersModule {}
